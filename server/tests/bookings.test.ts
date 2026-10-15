import { describe, expect, it } from 'vitest';
import { BookingModel, GymClassModel, MembershipModel, WebsiteSettingsModel } from '../src/models';
import { grantMembership, syncMembershipStatuses } from '../src/services/membership.service';
import { DEFAULT_SITE_SETTINGS, invalidateSettingsCache } from '../src/services/settings.service';
import { createPlan, createUser, loginAs } from './helpers';

async function activeMember() {
  const ctx = await loginAs('member');
  const plan = await createPlan({ durationDays: 30 });
  await grantMembership({ userId: ctx.user._id, planId: plan._id, mode: 'new', source: 'admin' });
  return ctx;
}

async function makeClass(capacity: number, hoursAhead = 48) {
  const startsAt = new Date(Date.now() + hoursAhead * 3600000);
  return GymClassModel.create({ title: 'HIIT', startsAt, endsAt: new Date(startsAt.getTime() + 3600000), capacity });
}

describe('class booking rules', () => {
  it('requires an active membership', async () => {
    const { c } = await loginAs('member');
    const cls = await makeClass(5);
    const res = await c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MEMBERSHIP_REQUIRED');
  });

  it('prevents duplicate bookings for the same class', async () => {
    const { c } = await activeMember();
    const cls = await makeClass(5);
    expect((await c.post('/api/v1/bookings/class').send({ classId: String(cls._id) })).status).toBe(201);
    const dup = await c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    expect(dup.status).toBe(409);
    expect((await GymClassModel.findById(cls._id))?.bookedCount).toBe(1);
  });

  it('never exceeds capacity under concurrent bookings; extra members are waitlisted', async () => {
    const cls = await makeClass(3);
    const members = await Promise.all(Array.from({ length: 8 }, () => activeMember()));
    const results = await Promise.all(members.map(({ c }) => c.post('/api/v1/bookings/class').send({ classId: String(cls._id) })));
    results.forEach((r) => expect(r.status).toBe(201));
    const statuses = results.map((r) => r.body.data.status);
    expect(statuses.filter((s) => s === 'confirmed')).toHaveLength(3);
    expect(statuses.filter((s) => s === 'waitlisted')).toHaveLength(5);
    const fresh = await GymClassModel.findById(cls._id).lean();
    expect(fresh).toMatchObject({ bookedCount: 3, waitlistCount: 5 });
  });

  it('promotes the earliest waitlisted member when a confirmed member cancels', async () => {
    const cls = await makeClass(1);
    const a = await activeMember();
    const b = await activeMember();
    const ba = await a.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    const bb = await b.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    expect(bb.body.data.status).toBe('waitlisted');
    expect((await a.c.post(`/api/v1/bookings/${ba.body.data._id}/cancel`).send({})).status).toBe(200);
    expect((await BookingModel.findById(bb.body.data._id))?.status).toBe('confirmed');
    expect(await GymClassModel.findById(cls._id).lean()).toMatchObject({ bookedCount: 1, waitlistCount: 0 });
  });

  it('enforces the cancellation window for members', async () => {
    const { c } = await activeMember();
    const cls = await makeClass(5, 2); // starts in 2h, default window is 4h
    const b = await c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    const res = await c.post(`/api/v1/bookings/${b.body.data._id}/cancel`).send({});
    expect(res.status).toBe(409);
  });

  it('respects the waitlist setting', async () => {
    await WebsiteSettingsModel.create({ key: 'site', data: { ...DEFAULT_SITE_SETTINGS, bookings: { ...DEFAULT_SITE_SETTINGS.bookings, allowWaitlist: false } } });
    invalidateSettingsCache();
    const cls = await makeClass(1);
    const a = await activeMember();
    const b = await activeMember();
    await a.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    const res = await b.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    expect(res.status).toBe(409);
    expect(await BookingModel.countDocuments({ gymClass: cls._id })).toBe(1);
  });

  it('members cannot cancel other members’ bookings', async () => {
    const cls = await makeClass(5);
    const a = await activeMember();
    const b = await activeMember();
    const ba = await a.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    expect((await b.c.post(`/api/v1/bookings/${ba.body.data._id}/cancel`).send({})).status).toBe(404);
  });

  it('cancelling a class cancels its bookings and frees the counters', async () => {
    const { c: admin } = await loginAs('admin');
    const cls = await makeClass(5);
    const a = await activeMember();
    await a.c.post('/api/v1/bookings/class').send({ classId: String(cls._id) });
    const res = await admin.post(`/api/v1/classes/${cls._id}/cancel`).send({ reason: 'Coach unwell' });
    expect(res.status).toBe(200);
    expect(await BookingModel.countDocuments({ gymClass: cls._id, status: 'cancelled' })).toBe(1);
    expect(await GymClassModel.findById(cls._id).lean()).toMatchObject({ status: 'cancelled', bookedCount: 0 });
  });
});

describe('attendance', () => {
  it('checks in by QR once per day and requires an active membership', async () => {
    const { c: admin } = await loginAs('admin');
    const { user, c } = await activeMember();
    const qr = await c.get('/api/v1/attendance/me/qr');
    expect(qr.body.data.payload).toMatch(/^APEX:/);
    const first = await admin.post('/api/v1/attendance/check-in').send({ qr: qr.body.data.payload });
    expect(first.status).toBe(201);
    expect(first.body.data.member.id).toBe(String(user._id));
    const second = await admin.post('/api/v1/attendance/check-in').send({ qr: qr.body.data.payload });
    expect(second.status).toBe(409);

    const lapsed = await createUser('member');
    const res = await admin.post('/api/v1/attendance/check-in').send({ memberId: String(lapsed._id) });
    expect(res.status).toBe(403);
  });

  it('rotating the QR invalidates the old code', async () => {
    const { c: admin } = await loginAs('admin');
    const { c } = await activeMember();
    const old = (await c.get('/api/v1/attendance/me/qr')).body.data.payload;
    await c.post('/api/v1/attendance/me/qr/rotate');
    expect((await admin.post('/api/v1/attendance/check-in').send({ qr: old })).status).toBe(404);
  });

  it('members cannot check anyone in', async () => {
    const { c } = await activeMember();
    expect((await c.post('/api/v1/attendance/check-in').send({ memberId: '0'.repeat(24) })).status).toBe(403);
  });
});

describe('membership lifecycle', () => {
  it('expires and activates memberships based on dates', async () => {
    const user = await createUser('member');
    const plan = await createPlan({ durationDays: 10 });
    const past = await grantMembership({ userId: user._id, planId: plan._id, mode: 'new', source: 'admin', startDate: new Date(Date.now() - 20 * 86400000) });
    expect(past.status).toBe('active'); // created with a start in the past
    const result = await syncMembershipStatuses();
    expect(result.expired).toBe(1);
    expect((await MembershipModel.findById(past._id))?.status).toBe('expired');

    const future = await grantMembership({ userId: user._id, planId: plan._id, mode: 'new', source: 'admin', startDate: new Date(Date.now() + 86400000) });
    expect(future.status).toBe('upcoming');
    await syncMembershipStatuses(new Date(Date.now() + 2 * 86400000));
    expect((await MembershipModel.findById(future._id))?.status).toBe('active');
  });

  it('only authorised staff can change membership status, and changes are audited', async () => {
    const member = await loginAs('member');
    const plan = await createPlan();
    const m = await grantMembership({ userId: member.user._id, planId: plan._id, mode: 'new', source: 'admin' });
    expect((await member.c.patch(`/api/v1/memberships/${m._id}`).send({ action: 'extend', days: 30, reason: 'please' })).status).toBe(403);
    const { c: admin } = await loginAs('admin');
    const res = await admin.patch(`/api/v1/memberships/${m._id}`).send({ action: 'extend', days: 5, reason: 'Gym closed for maintenance' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.data.endDate).getTime() - m.endDate.getTime()).toBe(5 * 86400000);
    const { AuditLogModel } = await import('../src/models');
    expect(await AuditLogModel.countDocuments({ action: 'membership.extend' })).toBe(1);
  });
});
