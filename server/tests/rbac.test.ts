import { describe, expect, it } from 'vitest';
import { MemberProfileModel, PaymentModel } from '../src/models';
import { createPlan, createUser, loginAs } from './helpers';

describe('role-based access control', () => {
  it('members cannot reach admin APIs', async () => {
    const { c } = await loginAs('member');
    for (const url of ['/api/v1/reports/overview', '/api/v1/payments', '/api/v1/settings', '/api/v1/users', '/api/v1/pages', '/api/v1/memberships', '/api/v1/settings/audit-logs']) {
      expect((await c.get(url)).status, url).toBe(403);
    }
    expect((await c.post('/api/v1/plans/admin').send({ name: 'x', slug: 'x', durationDays: 1, priceMinor: 1 })).status).toBe(403);
    expect((await c.put('/api/v1/themes/draft').send({})).status).toBe(403);
  });

  it('anonymous users get 401 on protected APIs', async () => {
    const { client } = await import('./helpers');
    const c = await client();
    expect((await c.get('/api/v1/members/me')).status).toBe(401);
    expect((await c.get('/api/v1/payments/me')).status).toBe(401);
  });

  it('trainers only see members assigned to them and never see finance data', async () => {
    const { user: trainer, c } = await loginAs('trainer');
    const assigned = await createUser('member');
    const other = await createUser('member');
    await MemberProfileModel.updateOne({ user: assigned._id }, { assignedTrainer: trainer._id });
    const plan = await createPlan();
    await PaymentModel.create({ user: assigned._id, plan: plan._id, planName: plan.name, provider: 'offline', baseAmountMinor: 100, amountMinor: 100, status: 'captured' });

    const list = await c.get('/api/v1/members');
    expect(list.status).toBe(200);
    expect(list.body.data.map((m: { id: string }) => m.id)).toEqual([String(assigned._id)]);

    const detail = await c.get(`/api/v1/members/${assigned._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.payments).toBeNull();

    expect((await c.get(`/api/v1/members/${other._id}`)).status).toBe(404);
    expect((await c.get(`/api/v1/members/${other._id}/progress`)).status).toBe(404);
    expect((await c.post('/api/v1/trainers/me/notes').send({ member: String(other._id), body: 'hi' })).status).toBe(404);
    expect((await c.get('/api/v1/payments')).status).toBe(403);
    expect((await c.get('/api/v1/settings')).status).toBe(403);
  });

  it('a trainer granted a permission gains exactly that capability', async () => {
    const { c } = await loginAs('trainer', { permissions: ['reports:read'] });
    expect((await c.get('/api/v1/reports/overview')).status).toBe(200);
    expect((await c.get('/api/v1/payments')).status).toBe(403);
  });

  it('role changes take effect immediately (role is loaded from the DB, not the token)', async () => {
    const { user, c } = await loginAs('admin');
    expect((await c.get('/api/v1/settings')).status).toBe(200);
    const { UserModel } = await import('../src/models');
    await UserModel.updateOne({ _id: user._id }, { role: 'member' });
    expect((await c.get('/api/v1/settings')).status).toBe(403);
  });
});

describe('member data ownership', () => {
  it('members cannot read or write another member’s data', async () => {
    const { c } = await loginAs('member');
    const victim = await createUser('member');
    expect((await c.get(`/api/v1/members/${victim._id}/progress`)).status).toBe(404);
    expect((await c.post(`/api/v1/members/${victim._id}/progress`).send({ date: new Date().toISOString(), weightKg: 80 })).status).toBe(404);
    expect((await c.get(`/api/v1/members/${victim._id}/photos`)).status).toBe(404);
    expect((await c.get(`/api/v1/members/${victim._id}/workout-logs`)).status).toBe(404);
    expect((await c.get(`/api/v1/members/${victim._id}`)).status).toBe(403);
  });

  it('receipts and support tickets are private to their owner', async () => {
    const { user: owner, c: ownerClient } = await loginAs('member');
    const { c: other } = await loginAs('member');
    const plan = await createPlan();
    const p = await PaymentModel.create({ user: owner._id, plan: plan._id, planName: plan.name, provider: 'offline', baseAmountMinor: 100, amountMinor: 100, status: 'captured', receiptNumber: 'APX-T-1', capturedAt: new Date() });
    expect((await other.get(`/api/v1/payments/${p._id}/receipt`)).status).toBe(404);
    const ok = await ownerClient.get(`/api/v1/payments/${p._id}/receipt`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/pdf');

    const t = await ownerClient.post('/api/v1/support').send({ subject: 'Locker issue', body: 'My locker code does not work' });
    expect(t.status).toBe(201);
    expect((await other.get(`/api/v1/support/${t.body.data._id}`)).status).toBe(404);
    const otherList = await other.get('/api/v1/support?scope=all');
    expect(otherList.body.data).toHaveLength(0);
  });
});
