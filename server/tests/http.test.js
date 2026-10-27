// HTTP-level tests that do not need a database.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, browserAgent } from './helpers.js';

describe('security middleware', () => {
  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('rejects a mismatched CSRF header', async () => {
    const { agent } = await browserAgent();
    const res = await agent.post('/api/auth/login').set('X-CSRF-Token', 'f'.repeat(64)).send({});
    expect(res.status).toBe(403);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/auth/csrf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns validation details with 400', async () => {
    const b = await browserAgent();
    const res = await b.post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('protects private routes with 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/users/me/profile')).status).toBe(401);
    expect((await request(app).get('/api/settings/draft')).status).toBe(401);
  });

  it('rejects forged and wrong-algorithm tokens', async () => {
    const forged = jwt.sign({ sub: '64b000000000000000000000', role: 'owner' }, 'not-the-secret');
    const res = await request(app).get('/api/auth/me').set('Cookie', `access_token=${forged}`);
    expect(res.status).toBe(401);
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"x","role":"owner"}').toString('base64url')}.`;
    expect((await request(app).get('/api/auth/me').set('Cookie', `access_token=${none}`)).status).toBe(401);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('handles malformed JSON', async () => {
    const b = await browserAgent();
    const res = await b.post('/api/contact').set('Content-Type', 'application/json').send('{"bad"');
    expect(res.status).toBe(400);
  });
});

describe('payments webhook & admin routes', () => {
  it('rejects webhooks without a valid signature (no CSRF token needed)', async () => {
    const res = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').send('{"event":"payment.captured"}');
    expect(res.status).toBe(400);
  });

  it('requires authentication for admin, member and report endpoints', async () => {
    for (const path of ['/api/admin/plans', '/api/members', '/api/reports/overview', '/api/payments', '/api/attendance/qr', '/api/bookings/me', '/api/notifications']) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });

  it('serves the assistant status without auth', async () => {
    const res = await request(app).get('/api/assistant/status');
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  });
});
