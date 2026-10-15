import { describe, expect, it } from 'vitest';
import { SessionModel, UserModel } from '../src/models';
import { sentEmails } from '../src/services/email.service';
import { PASSWORD, app, client, createUser, loginAs } from './helpers';
import supertest from 'supertest';

const valid = { name: 'Asha Verma', email: 'asha@test.dev', password: 'GoodPassw0rd', acceptTerms: true };

describe('registration & login', () => {
  it('registers a member, sets httpOnly cookies and returns the profile', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'asha@test.dev', role: 'member' });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((x) => x.startsWith('apex_at=') && /HttpOnly/i.test(x))).toBe(true);
    expect(cookies.some((x) => x.startsWith('apex_rt=') && /HttpOnly/i.test(x) && /Path=\/api\/v1\/auth/.test(x))).toBe(true);
    const me = await c.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('asha@test.dev');
    expect(me.body.data.user.passwordHash).toBeUndefined();
  });

  it('never lets a browser choose its role', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register').send({ ...valid, role: 'admin', permissions: ['settings:write'] });
    expect(res.status).toBe(201);
    const user = await UserModel.findOne({ email: valid.email }).lean();
    expect(user?.role).toBe('member');
    expect(user?.permissions).toEqual([]);
  });

  it('validates input and rejects weak passwords and duplicates', async () => {
    const c = await client();
    const weak = await c.post('/api/v1/auth/register').send({ ...valid, password: 'short' });
    expect(weak.status).toBe(422);
    expect(weak.body.error.details.some((d: { path: string }) => d.path === 'body.password')).toBe(true);
    await c.post('/api/v1/auth/register').send(valid);
    const dup = await (await client()).post('/api/v1/auth/register').send(valid);
    expect(dup.status).toBe(409);
  });

  it('rejects wrong passwords with a generic message and locks after repeated failures', async () => {
    const user = await createUser('member');
    const c = await client();
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password-1' });
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe('Incorrect email or password');
    }
    const locked = await c.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(locked.status).toBe(423);
    const unknown = await c.post('/api/v1/auth/login').send({ email: 'nobody@test.dev', password: 'whatever123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe('Incorrect email or password');
  });

  it('blocks suspended accounts at login and on existing sessions', async () => {
    const { user, c } = await loginAs('member');
    await UserModel.updateOne({ _id: user._id }, { status: 'suspended' });
    expect((await c.get('/api/v1/auth/me')).status).toBe(401);
    const again = await (await client()).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(again.status).toBe(403);
  });
});

describe('CSRF protection', () => {
  it('rejects state-changing requests without the CSRF header', async () => {
    const agent = supertest.agent(app);
    await agent.get('/api/v1/auth/csrf');
    const res = await agent.post('/api/v1/auth/login').send({ email: 'a@b.dev', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects a mismatched CSRF header', async () => {
    const c = await client();
    const res = await c.agent.post('/api/v1/auth/login').set('X-CSRF-Token', 'not-the-token').send({ email: 'a@b.dev', password: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const { user, c } = await loginAs('member');
    const first = (await SessionModel.findOne({ user: user._id }).lean())!;
    // Capture the current refresh cookie, then refresh (rotation).
    const cookieJar = c.agent.jar.getCookies({ path: '/api/v1/auth', domain: '127.0.0.1', secure: false, script: false });
    const oldRt = cookieJar.find((x) => x.name === 'apex_rt')!.value;
    const r1 = await c.post('/api/v1/auth/refresh');
    expect(r1.status).toBe(200);
    expect(await SessionModel.countDocuments({ user: user._id })).toBe(2);
    // Replay the rotated token after the grace window.
    await SessionModel.updateOne({ _id: first._id }, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });
    const replay = await supertest(app).post('/api/v1/auth/refresh').set('X-CSRF-Token', 'tok123').set('Cookie', `apex_rt=${oldRt}; apex_csrf=tok123`);
    expect(replay.status).toBe(401);
    expect(await SessionModel.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
  });

  it('logout revokes the session', async () => {
    const { user, c } = await loginAs('member');
    await c.post('/api/v1/auth/logout');
    expect(await SessionModel.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    expect((await c.post('/api/v1/auth/refresh')).status).toBe(401);
  });
});

describe('password reset', () => {
  it('sends a single-use reset link and revokes sessions after reset', async () => {
    const { user, c } = await loginAs('member');
    const anon = await client();
    const res = await anon.post('/api/v1/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    const mail = sentEmails.find((m) => m.to === user.email);
    expect(mail).toBeTruthy();
    const token = decodeURIComponent(/token=([^\s&]+)/.exec(mail!.text)![1]);
    const reset = await anon.post('/api/v1/auth/reset-password').send({ token, password: 'BrandNewPass9' });
    expect(reset.status).toBe(200);
    expect(await SessionModel.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    const reuse = await anon.post('/api/v1/auth/reset-password').send({ token, password: 'AnotherPass99' });
    expect(reuse.status).toBe(400);
    expect((await anon.post('/api/v1/auth/login').send({ email: user.email, password: 'BrandNewPass9' })).status).toBe(200);
    expect((await c.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('does not reveal whether an email exists', async () => {
    const res = await (await client()).post('/api/v1/auth/forgot-password').send({ email: 'ghost@test.dev' });
    expect(res.status).toBe(200);
    expect(sentEmails).toHaveLength(0);
  });
});
