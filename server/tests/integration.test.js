// End-to-end API tests against a real MongoDB. Run with:
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/aurum_test npm test -w server
// The database named in TEST_MONGO_URI is DROPPED before and after the run — never point it at real data.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';

const uri = process.env.TEST_MONGO_URI;
const sent = [];
vi.mock('../src/services/email.service.js', async (orig) => {
  const mod = await orig();
  return { ...mod, sendEmail: vi.fn(async (msg) => { sent.push(msg); return { delivered: false }; }) };
});

const tokenFrom = (msg) => /token=([a-f0-9]{64})/.exec(msg.cta.href)[1];

describe.skipIf(!uri)('API integration (MongoDB)', () => {
  let helpers;
  let User;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    helpers = await import('./helpers.js');
    ({ User } = await import('../src/models/index.js'));
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  const member = { name: 'Asha Rao', email: 'asha@example.com', password: 'Str0ngPass1', acceptTerms: true };

  it('registers, verifies email and reads /me', async () => {
    const b = await helpers.browserAgent();
    const reg = await b.post('/api/auth/register').send(member);
    expect(reg.status).toBe(201);
    expect(reg.body.data.user).toMatchObject({ email: member.email, role: 'member', emailVerified: false });
    expect(reg.body.data.user.password).toBeUndefined();
    expect(reg.body.data.profile.referralCode).toMatch(/^[A-Z]{4}/);
    const cookies = reg.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/access_token=.*HttpOnly/);

    const verify = sent.find((m) => m.to === member.email && m.subject.includes('Verify'));
    expect((await b.post('/api/auth/verify-email').send({ token: tokenFrom(verify) })).status).toBe(200);
    const me = await b.get('/api/auth/me');
    expect(me.body.data.user.emailVerified).toBe(true);
  });

  it('rejects duplicate emails with 409', async () => {
    const b = await helpers.browserAgent();
    expect((await b.post('/api/auth/register').send(member)).status).toBe(409);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const b = await helpers.browserAgent();
    const login = await b.post('/api/auth/login').send({ email: member.email, password: member.password });
    expect(login.status).toBe(200);
    const oldRefresh = login.headers['set-cookie'].find((c) => c.startsWith('refresh_token=')).split(';')[0];

    expect((await b.post('/api/auth/refresh').send()).status).toBe(200);
    // Replaying the old (now revoked) token revokes the whole family.
    const replay = await (await import('supertest')).default(helpers.app)
      .post('/api/auth/refresh').set('Cookie', `${oldRefresh}; csrf_token=${b.token}`).set('X-CSRF-Token', b.token);
    expect(replay.status).toBe(401);
    expect((await b.post('/api/auth/refresh').send()).status).toBe(401);
  });

  it('locks the account after 5 failed logins', async () => {
    const b = await helpers.browserAgent();
    for (let i = 0; i < 5; i += 1) {
      expect((await b.post('/api/auth/login').send({ email: member.email, password: 'Wrong1234' })).status).toBe(401);
    }
    expect((await b.post('/api/auth/login').send({ email: member.email, password: member.password })).status).toBe(429);
  });

  it('resets the password with a single-use token and unlocks the account', async () => {
    const b = await helpers.browserAgent();
    const res = await b.post('/api/auth/forgot-password').send({ email: member.email });
    expect(res.status).toBe(200);
    // Unknown emails get the same response.
    expect((await b.post('/api/auth/forgot-password').send({ email: 'ghost@example.com' })).status).toBe(200);

    const token = tokenFrom(sent.filter((m) => m.subject.includes('Reset')).at(-1));
    expect((await b.post('/api/auth/reset-password').send({ token, password: 'N3wPassword' })).status).toBe(200);
    expect((await b.post('/api/auth/reset-password').send({ token, password: 'N3wPassword2' })).status).toBe(400);
    expect((await b.post('/api/auth/login').send({ email: member.email, password: 'N3wPassword' })).status).toBe(200);
    member.password = 'N3wPassword';
  });

  it('updates profile, emergency contact and requests deletion', async () => {
    const b = await helpers.browserAgent();
    await b.post('/api/auth/login').send({ email: member.email, password: member.password });
    const p = await b.patch('/api/users/me/profile').send({
      fitnessGoals: ['Lose 5 kg'], heightCm: 168, emergencyContact: { name: 'Ravi', phone: '+91 98765 43210', relation: 'Brother' },
    });
    expect(p.status).toBe(200);
    expect(p.body.data.profile.emergencyContact.name).toBe('Ravi');
    expect((await b.patch('/api/users/me/profile').send({ heightCm: 5 })).status).toBe(400);
    expect((await b.post('/api/users/me/deletion-request').send({ reason: 'Moving city' })).status).toBe(200);
    expect((await b.post('/api/users/me/deletion-request').send({})).status).toBe(409);
    expect((await b.delete('/api/users/me/deletion-request')).status).toBe(200);
  });

  it('enforces role-based access to the CMS and publishes drafts', async () => {
    const m = await helpers.browserAgent();
    await m.post('/api/auth/login').send({ email: member.email, password: member.password });
    expect((await m.get('/api/settings/draft')).status).toBe(403);

    await User.create({ name: 'Owner', email: 'owner@example.com', password: 'Own3rPass', role: 'owner', emailVerified: true });
    const a = await helpers.browserAgent();
    await a.post('/api/auth/login').send({ email: 'owner@example.com', password: 'Own3rPass' });

    const save = await a.patch('/api/settings/draft').send({ hero: { title: 'New headline' } });
    expect(save.status).toBe(200);
    expect(save.body.data.hasUnpublishedChanges).toBe(true);
    expect((await a.get('/api/settings/public')).body.data.hero.title).not.toBe('New headline');

    expect((await a.post('/api/settings/publish').send()).status).toBe(200);
    expect((await a.get('/api/settings/public')).body.data.hero.title).toBe('New headline');
    expect((await a.patch('/api/settings/draft').send({ theme: { accent: 'red' } })).status).toBe(400);
  });

  it('stores contact inquiries and silently drops honeypot spam', async () => {
    const { ContactInquiry } = await import('../src/models/index.js');
    const b = await helpers.browserAgent();
    const okRes = await b.post('/api/contact').send({ name: 'Neha', email: 'neha@example.com', message: 'I would like a trial session.', startedAt: Date.now() - 10_000 });
    expect(okRes.status).toBe(201);
    const bot = await b.post('/api/contact').send({ name: 'Bot', email: 'bot@example.com', message: 'Buy cheap followers now', website: 'x' });
    expect(bot.status).toBe(201);
    expect(await ContactInquiry.countDocuments()).toBe(1);
  });

  it('serves only published, active public content', async () => {
    const { MembershipPlan } = await import('../src/models/index.js');
    await MembershipPlan.create([
      { name: 'Live', slug: 'live', tier: 'basic', status: 'published', pricing: [{ period: 'monthly', pricePaise: 100000 }] },
      { name: 'Hidden', slug: 'hidden', tier: 'elite', status: 'draft', pricing: [{ period: 'monthly', pricePaise: 100000 }] },
    ]);
    const res = await (await helpers.browserAgent()).get('/api/memberships/plans');
    expect(res.body.data.map((p) => p.slug)).toEqual(['live']);
  });
});
