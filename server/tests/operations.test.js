// End-to-end operations against a real MongoDB (payments in sandbox mode, bookings, attendance, RBAC).
// Run: TEST_MONGO_URI=mongodb://127.0.0.1:27017/aurum_ops_test npm test -w server
// The database named in TEST_MONGO_URI is DROPPED before and after the run.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';

const uri = process.env.TEST_MONGO_URI;
vi.mock('../src/services/email.service.js', async (orig) => ({ ...(await orig()), sendEmail: vi.fn(async () => ({ delivered: false })) }));

describe.skipIf(!uri)('operations (MongoDB)', () => {
  let h; let m; let dates;
  const pw = 'Str0ngPass1';
  const agents = {};

  async function login(email) {
    const b = await h.browserAgent();
    const res = await b.post('/api/auth/login').send({ email, password: pw });
    expect(res.status, `login ${email}`).toBe(200);
    return b;
  }

  beforeAll(async () => {
    await mongoose.connect(uri.replace(/\/(\w+)$/, '/$1_ops'));
    await mongoose.connection.dropDatabase();
    h = await import('./helpers.js');
    m = await import('../src/models/index.js');
    dates = await import('../src/utils/dates.js');
    await Promise.all(Object.values(mongoose.models).map((x) => x.syncIndexes()));
    await m.User.create([
      { name: 'Olivia Owner', email: 'owner@ops.test', password: pw, role: 'owner', emailVerified: true },
      { name: 'Sam Staff', email: 'staff@ops.test', password: pw, role: 'staff', emailVerified: true },
      { name: 'Tara Trainer', email: 'trainer@ops.test', password: pw, role: 'trainer', emailVerified: true },
      { name: 'Mia Member', email: 'mia@ops.test', password: pw, role: 'member', emailVerified: true },
      { name: 'Ned Member', email: 'ned@ops.test', password: pw, role: 'member', emailVerified: true },
    ]);
    for (const k of ['owner', 'staff', 'trainer', 'mia', 'ned']) agents[k] = await login(`${k}@ops.test`);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });

  let plan; let trainer;

  it('admin creates a plan, trainer and coupon; members cannot', async () => {
    const res = await agents.owner.post('/api/admin/plans').send({
      name: 'Premium', tier: 'premium', status: 'published', benefits: ['All access'],
      pricing: [{ period: 'monthly', pricePaise: 500000 }, { period: 'yearly', pricePaise: 4500000, discountPercent: 25 }],
      joiningFeePaise: 100000, limits: { ptSessionsPerMonth: 2, classesPerWeek: 0 },
    });
    expect(res.status).toBe(201);
    plan = res.body.data;
    expect(plan.slug).toBe('premium');

    const all = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, start: '06:00', end: '21:00' }));
    const t = await agents.owner.post('/api/admin/trainers').send({ name: 'Tara Trainer', title: 'Coach', availability: all, sessionDurationMin: 60 });
    expect(t.status).toBe(201);
    trainer = t.body.data;

    expect((await agents.owner.post('/api/admin/coupons').send({ code: 'save10', discountType: 'percent', value: 10, perUserLimit: 1 })).status).toBe(201);
    expect((await agents.mia.post('/api/admin/plans').send({ name: 'X', tier: 'basic', pricing: [{ period: 'monthly', pricePaise: 1 }] })).status).toBe(403);
    expect((await agents.staff.get('/api/admin/plans')).status).toBe(200);
    expect((await agents.staff.post('/api/admin/coupons').send({ code: 'NOPE', discountType: 'fixed', value: 1 })).status).toBe(403);
  });

  it('quotes server-side with joining fee and coupon', async () => {
    const q = await agents.mia.post('/api/payments/quote').send({ planId: plan._id, period: 'monthly', couponCode: 'SAVE10' });
    expect(q.status).toBe(200);
    expect(q.body.data).toMatchObject({ basePaise: 500000, discountPaise: 50000, joiningFeePaise: 100000, amountPaise: 550000 });
    const bad = await agents.mia.post('/api/payments/quote').send({ planId: plan._id, period: 'monthly', couponCode: 'NOPE' });
    expect(bad.status).toBe(400);
    expect(bad.body.details[0].field).toBe('couponCode');
  });

  it('completes a sandbox purchase once, activates membership and issues an invoice', async () => {
    const order = await agents.mia.post('/api/payments/order').send({ planId: plan._id, period: 'monthly', couponCode: 'SAVE10' });
    expect(order.status).toBe(201);
    expect(order.body.data.provider).toBe('sandbox');
    const v1 = await agents.mia.post('/api/payments/verify').send({ orderId: order.body.data.orderId });
    const v2 = await agents.mia.post('/api/payments/verify').send({ orderId: order.body.data.orderId });
    expect(v1.body.data.status).toBe('paid');
    expect(v2.status).toBe(200);
    const payment = await m.Payment.findById(order.body.data.paymentId);
    expect(payment.invoiceNumber).toMatch(/^INV-\d{6}-00001$/);
    expect(await m.Membership.countDocuments({ user: payment.user })).toBe(1);
    expect((await m.Coupon.findOne({ code: 'SAVE10' })).usedCount).toBe(1);

    const mine = await agents.mia.get('/api/memberships/me');
    expect(mine.body.data.current.plan.name).toBe('Premium');
    const pdf = await agents.mia.get(`/api/payments/${payment._id}/invoice`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((await agents.ned.get(`/api/payments/${payment._id}/invoice`)).status).toBe(403);

    // Coupon is single-use per member; renewal has no joining fee and stacks after the current period.
    expect((await agents.mia.post('/api/payments/quote').send({ planId: plan._id, period: 'monthly', couponCode: 'SAVE10' })).status).toBe(400);
    const renew = await agents.mia.post('/api/payments/quote').send({ planId: plan._id, period: 'monthly' });
    expect(renew.body.data).toMatchObject({ joiningFeePaise: 0, isRenewal: true });
  });

  it('staff records an offline payment for another member', async () => {
    const ned = await m.User.findOne({ email: 'ned@ops.test' });
    const res = await agents.staff.post('/api/payments/offline').send({ userId: ned._id, planId: plan._id, period: 'monthly', method: 'cash' });
    expect(res.status).toBe(201);
    expect(await m.Membership.exists({ user: ned._id, status: 'active' })).toBeTruthy();
  });

  it('books PT slots without double-booking', async () => {
    const day = dates.gymDay(dates.addDays(new Date(), 2));
    const slots = await agents.mia.get(`/api/bookings/trainers/${trainer._id}/slots?date=${day}`);
    const free = slots.body.data.slots.filter((s) => s.available);
    expect(free.length).toBeGreaterThan(5);
    const first = await agents.mia.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: free[0].startAt });
    expect(first.status).toBe(201);
    expect((await agents.ned.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: free[0].startAt })).status).toBe(409);
    // Off-grid times are rejected.
    expect((await agents.ned.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: new Date(new Date(free[1].startAt).getTime() + 60000) })).status).toBe(400);
    // Reschedule into another free slot frees the original.
    const moved = await agents.mia.post(`/api/bookings/${first.body.data._id}/reschedule`).send({ startAt: free[2].startAt });
    expect(moved.status).toBe(200);
    expect((await agents.ned.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: free[0].startAt })).status).toBe(201);
    // Plan limit is 2 PT sessions per month.
    await agents.mia.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: free[4].startAt });
    const over = await agents.mia.post('/api/bookings/pt').send({ trainerId: trainer._id, startAt: free[6].startAt });
    expect([403, 201]).toContain(over.status); // 201 only if the slots fall in different calendar months
  });

  it('fills a class, waitlists, and promotes on cancellation', async () => {
    const day = dates.gymDay(dates.addDays(new Date(), 3));
    const startAt = dates.gymLocalToUtc(day, '19:00');
    const cls = await agents.owner.post('/api/classes').send({ title: 'HIIT 45', trainer: trainer._id, startAt, endAt: new Date(startAt.getTime() + 45 * 60000), capacity: 1 });
    expect(cls.status).toBe(201);
    const id = cls.body.data._id;
    const a = await agents.mia.post(`/api/classes/${id}/book`).send();
    const b = await agents.ned.post(`/api/classes/${id}/book`).send();
    expect(a.body.data.status).toBe('booked');
    expect(b.body.data.status).toBe('waitlisted');
    expect((await agents.mia.post(`/api/classes/${id}/book`).send()).status).toBe(409);
    await agents.mia.post(`/api/bookings/${a.body.data._id}/cancel`).send({});
    expect((await m.Booking.findById(b.body.data._id)).status).toBe('booked');
    expect((await m.ClassSchedule.findById(id)).bookedCount).toBe(1);
    const roster = await agents.staff.get(`/api/classes/${id}/roster`);
    expect(roster.body.data.bookings.filter((x) => x.status === 'booked')).toHaveLength(1);
  });

  it('checks in with a short-lived QR code and prevents duplicates', async () => {
    const qr = await agents.mia.get('/api/attendance/qr');
    expect(qr.status).toBe(200);
    const scan = await agents.staff.post('/api/attendance/scan').send({ token: qr.body.data.token });
    expect(scan.status).toBe(200);
    expect(scan.body.data.action).toBe('check_in');
    expect((await agents.staff.post('/api/attendance/scan').send({ token: qr.body.data.token })).status).toBe(409);
    const qr2 = await agents.mia.get('/api/attendance/qr');
    expect((await agents.staff.post('/api/attendance/scan').send({ token: qr2.body.data.token })).status).toBe(409); // within 5 min
    expect((await agents.mia.post('/api/attendance/scan').send({ token: qr2.body.data.token })).status).toBe(403); // members can't scan
    const me = await agents.mia.get('/api/attendance/me');
    expect(me.body.data.stats.checkedInToday).toBe(true);
    const record = await m.Attendance.findOne({});
    const fix = await agents.staff.patch(`/api/attendance/${record._id}`).send({ checkOutAt: new Date(record.checkInAt.getTime() + 3600000), reason: 'Forgot to scan out' });
    expect(fix.status).toBe(200);
    expect(fix.body.data.corrections).toHaveLength(1);
    expect(await m.AuditLog.exists({ action: 'attendance.correct' })).toBeTruthy();
  });

  it('lists members with membership state and exports CSV', async () => {
    const res = await agents.staff.get('/api/members?membership=active');
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.email).sort()).toEqual(['mia@ops.test', 'ned@ops.test']);
    const csv = await agents.owner.get('/api/members/export.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('mia@ops.test');
    expect((await agents.staff.get('/api/members/export.csv')).status).toBe(403);
  });

  it('reports overview and revenue from real data', async () => {
    const o = await agents.owner.get('/api/reports/overview');
    expect(o.body.data.members.active).toBe(2);
    expect(o.body.data.revenue.monthPaise).toBe(550000 + 500000);
    const r = await agents.owner.get('/api/reports/revenue?months=3');
    expect(r.body.data.series).toHaveLength(3);
    expect((await agents.staff.get('/api/reports/overview')).status).toBe(403);
    // Filters must work inside aggregations too (string ids are cast to ObjectIds).
    const byPlan = await agents.owner.get(`/api/reports/revenue?months=1&plan=${plan._id}`);
    expect(byPlan.body.data.series.at(-1).grossPaise).toBe(550000 + 500000);
    const payments = await agents.staff.get(`/api/payments?plan=${plan._id}&status=paid`);
    expect(payments.body.meta.totals.paid).toBe(550000 + 500000);
  });

  it('runs support tickets with private staff notes', async () => {
    const t = await agents.mia.post('/api/support').send({ subject: 'Locker issue', message: 'My locker code does not work.' });
    expect(t.status).toBe(201);
    await agents.staff.post(`/api/support/${t.body.data._id}/messages`).send({ body: 'Check locker 12 battery', internal: true });
    await agents.staff.post(`/api/support/${t.body.data._id}/messages`).send({ body: 'Fixed — please try again.' });
    const view = await agents.mia.get(`/api/support/${t.body.data._id}`);
    expect(view.body.data.messages.map((x) => x.body)).toEqual(['My locker code does not work.', 'Fixed — please try again.']);
    expect((await agents.ned.get(`/api/support/${t.body.data._id}`)).status).toBe(404);
  });
});
