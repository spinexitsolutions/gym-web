import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { CouponModel, CouponRedemptionModel, MemberProfileModel, MembershipModel, PaymentModel, WebhookEventModel, LoyaltyTransactionModel } from '../src/models';
import { hmacSha256Hex } from '../src/utils/crypto';
import { sandboxSecret } from '../src/services/payments/sandbox.provider';
import { razorpayProvider } from '../src/services/payments/razorpay.provider';
import { app, createPlan, createUser, loginAs, type Client } from './helpers';

async function checkout(c: Client, planId: string, extra: Record<string, unknown> = {}) {
  const res = await c.post('/api/v1/payments/checkout').send({ planId, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data;
}

async function payInSandbox(c: Client, orderId: string, outcome: 'success' | 'failure' = 'success') {
  const gw = await c.post('/api/v1/payments/sandbox/complete').send({ orderId, outcome });
  expect(gw.status).toBe(200);
  return gw.body.data as { paymentId: string; signature: string };
}

const razorpayWebhook = (body: object, secret = 'rzp_test_webhook_secret', eventId = `evt_${Math.random()}`) => {
  const raw = JSON.stringify(body);
  return supertest(app).post('/api/v1/payments/webhook/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', hmacSha256Hex(secret, raw)).set('X-Razorpay-Event-Id', eventId).send(raw);
};

describe('server-side pricing', () => {
  it('ignores any amount sent by the browser and charges the plan price', async () => {
    const { c } = await loginAs('member');
    const plan = await createPlan({ priceMinor: 349900 });
    const data = await checkout(c, String(plan._id), { amountMinor: 100, priceMinor: 1 });
    expect(data.checkout.amountMinor).toBe(349900);
    const p = await PaymentModel.findOne({ orderId: data.checkout.orderId }).lean();
    expect(p?.amountMinor).toBe(349900);
  });

  it('applies coupons on the server and enforces per-user limits', async () => {
    const { c } = await loginAs('member');
    const plan = await createPlan({ priceMinor: 100000 });
    await CouponModel.create({ code: 'SAVE20', type: 'percent', value: 20, perUserLimit: 1 });
    const q = await c.post('/api/v1/payments/quote').send({ planId: String(plan._id), couponCode: 'save20' });
    expect(q.body.data).toMatchObject({ baseAmountMinor: 100000, discountMinor: 20000, amountMinor: 80000 });
    const data = await checkout(c, String(plan._id), { couponCode: 'SAVE20' });
    const { paymentId, signature } = await payInSandbox(c, data.checkout.orderId);
    await c.post('/api/v1/payments/verify').send({ orderId: data.checkout.orderId, paymentId, signature });
    expect(await CouponRedemptionModel.countDocuments()).toBe(1);
    expect((await CouponModel.findOne({ code: 'SAVE20' }))?.usedCount).toBe(1);
    const again = await c.post('/api/v1/payments/quote').send({ planId: String(plan._id), couponCode: 'SAVE20' });
    expect(again.status).toBe(422);
  });

  it('rejects expired and inactive plans', async () => {
    const { c } = await loginAs('member');
    const plan = await createPlan({ active: false });
    expect((await c.post('/api/v1/payments/checkout').send({ planId: String(plan._id) })).status).toBe(404);
    await CouponModel.create({ code: 'OLD', type: 'flat', value: 100, validUntil: new Date(Date.now() - 1000) });
    const live = await createPlan();
    expect((await c.post('/api/v1/payments/quote').send({ planId: String(live._id), couponCode: 'OLD' })).status).toBe(422);
  });
});

describe('checkout verification', () => {
  it('activates the membership only after the signature is verified', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ durationDays: 30 });
    const data = await checkout(c, String(plan._id));
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(0);

    const { paymentId } = await payInSandbox(c, data.checkout.orderId);
    const forged = await c.post('/api/v1/payments/verify').send({ orderId: data.checkout.orderId, paymentId, signature: 'f'.repeat(64) });
    expect(forged.status).toBe(400);
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(0);
    expect((await PaymentModel.findOne({ orderId: data.checkout.orderId }))?.status).toBe('created');
  });

  it('activates exactly one membership even if verify is called repeatedly/concurrently', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ durationDays: 30 });
    const data = await checkout(c, String(plan._id));
    const { paymentId, signature } = await payInSandbox(c, data.checkout.orderId);
    const body = { orderId: data.checkout.orderId, paymentId, signature };
    const results = await Promise.all([1, 2, 3].map(() => c.post('/api/v1/payments/verify').send(body)));
    results.forEach((r) => expect(r.status).toBe(200));
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(1);
    const m = await MembershipModel.findOne({ user: user._id }).lean();
    expect(m?.status).toBe('active');
    expect(Math.round((m!.endDate.getTime() - m!.startDate.getTime()) / 86400000)).toBe(30);
    const p = await PaymentModel.findOne({ orderId: data.checkout.orderId }).lean();
    expect(p?.status).toBe('captured');
    expect(p?.receiptNumber).toMatch(/^APX-\d{4}-\d{6}$/);
    const me = await c.get('/api/v1/memberships/me');
    expect(me.body.data.active.planName).toBe(plan.name);
  });

  it('records failed payments without activating anything', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan();
    const data = await checkout(c, String(plan._id));
    const { paymentId, signature } = await payInSandbox(c, data.checkout.orderId, 'failure');
    const res = await c.post('/api/v1/payments/verify').send({ orderId: data.checkout.orderId, paymentId, signature });
    expect(res.status).toBe(400);
    expect((await PaymentModel.findOne({ orderId: data.checkout.orderId }))?.status).toBe('failed');
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(0);
  });

  it('a member cannot verify someone else’s order', async () => {
    const { c: alice } = await loginAs('member');
    const { c: mallory } = await loginAs('member');
    const plan = await createPlan();
    const data = await checkout(alice, String(plan._id));
    const { paymentId, signature } = await payInSandbox(alice, data.checkout.orderId);
    const res = await mallory.post('/api/v1/payments/verify').send({ orderId: data.checkout.orderId, paymentId, signature });
    expect(res.status).toBe(404);
  });

  it('queues renewals after the current membership and supports immediate upgrades', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ durationDays: 30 });
    for (const mode of ['auto', 'auto'] as const) {
      const d = await checkout(c, String(plan._id), { mode });
      const g = await payInSandbox(c, d.checkout.orderId);
      await c.post('/api/v1/payments/verify').send({ orderId: d.checkout.orderId, paymentId: g.paymentId, signature: g.signature });
    }
    const ms = await MembershipModel.find({ user: user._id }).sort({ startDate: 1 }).lean();
    expect(ms.map((m) => m.status)).toEqual(['active', 'upcoming']);
    expect(ms[1].startDate.getTime()).toBe(ms[0].endDate.getTime());

    const premium = await createPlan({ durationDays: 90, priceMinor: 900000 });
    const d = await checkout(c, String(premium._id), { mode: 'upgrade' });
    const g = await payInSandbox(c, d.checkout.orderId);
    await c.post('/api/v1/payments/verify').send({ orderId: d.checkout.orderId, paymentId: g.paymentId, signature: g.signature });
    const active = await MembershipModel.findOne({ user: user._id, status: 'active' }).lean();
    expect(String(active?.plan)).toBe(String(premium._id));
    expect(await MembershipModel.countDocuments({ user: user._id, status: 'upgraded' })).toBe(1);
  });

  it('allows a trial plan only once and activates free plans without a gateway', async () => {
    const { user, c } = await loginAs('member');
    const trial = await createPlan({ priceMinor: 0, isTrial: true, durationDays: 7 });
    const res = await c.post('/api/v1/payments/checkout').send({ planId: String(trial._id) });
    expect(res.status).toBe(201);
    expect(res.body.data.free).toBe(true);
    expect(await MembershipModel.countDocuments({ user: user._id, 'planSnapshot.isTrial': true })).toBe(1);
    expect((await MemberProfileModel.findOne({ user: user._id }))?.trialUsed).toBe(true);
    expect((await c.post('/api/v1/payments/checkout').send({ planId: String(trial._id) })).status).toBe(409);
  });
});

describe('payment signatures', () => {
  it('verifies Razorpay checkout signatures with HMAC-SHA256(order|payment)', () => {
    const sig = hmacSha256Hex('rzp_test_key_secret', 'order_1|pay_1');
    expect(razorpayProvider.verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig })).toBe(true);
    expect(razorpayProvider.verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig })).toBe(false);
    expect(razorpayProvider.verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'abc' })).toBe(false);
  });

  it('verifies webhook signatures over the raw body', () => {
    const raw = Buffer.from('{"event":"payment.captured"}');
    expect(razorpayProvider.verifyWebhookSignature(raw, hmacSha256Hex('rzp_test_webhook_secret', raw))).toBe(true);
    expect(razorpayProvider.verifyWebhookSignature(Buffer.from('{"event":"payment.captured" }'), hmacSha256Hex('rzp_test_webhook_secret', raw))).toBe(false);
    expect(sandboxSecret()).not.toContain('test-secret');
  });
});

describe('webhooks', () => {
  const capturedEvent = (orderId: string, amount: number, payId = 'pay_wh_1') => ({
    event: 'payment.captured',
    payload: { payment: { entity: { id: payId, order_id: orderId, amount, currency: 'INR', status: 'captured', method: 'upi' } } },
  });

  it('rejects webhooks with an invalid signature', async () => {
    const res = await razorpayWebhook({ event: 'payment.captured', payload: {} }, 'wrong-secret');
    expect(res.status).toBe(400);
    expect(await WebhookEventModel.countDocuments()).toBe(0);
  });

  it('activates the membership from a webhook and ignores duplicate deliveries', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ priceMinor: 349900 });
    const data = await checkout(c, String(plan._id));
    const evt = capturedEvent(data.checkout.orderId, 349900);
    const first = await razorpayWebhook(evt, undefined, 'evt_same');
    expect(first.status).toBe(200);
    const second = await razorpayWebhook(evt, undefined, 'evt_same');
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    // A retry with a different event id for the same payment is still idempotent.
    await razorpayWebhook(evt, undefined, 'evt_retry');
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(1);
    const p = await PaymentModel.findOne({ orderId: data.checkout.orderId }).lean();
    expect(p).toMatchObject({ status: 'captured', verifiedVia: 'webhook', providerPaymentId: 'pay_wh_1', method: 'upi' });
  });

  it('webhook + browser verification racing still yields one membership', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ priceMinor: 120000 });
    const data = await checkout(c, String(plan._id));
    const g = await payInSandbox(c, data.checkout.orderId);
    await Promise.all([
      c.post('/api/v1/payments/verify').send({ orderId: data.checkout.orderId, paymentId: g.paymentId, signature: g.signature }),
      razorpayWebhook(capturedEvent(data.checkout.orderId, 120000, g.paymentId)),
    ]);
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(1);
  });

  it('flags an amount mismatch instead of activating', async () => {
    const { user, c } = await loginAs('member');
    const plan = await createPlan({ priceMinor: 500000 });
    const data = await checkout(c, String(plan._id));
    const res = await razorpayWebhook(capturedEvent(data.checkout.orderId, 100));
    expect(res.status).toBe(400);
    expect(await MembershipModel.countDocuments({ user: user._id })).toBe(0);
    expect((await PaymentModel.findOne({ orderId: data.checkout.orderId }))?.failureReason).toMatch(/mismatch/i);
  });

  it('marks failed payments from payment.failed events', async () => {
    const { c } = await loginAs('member');
    const plan = await createPlan();
    const data = await checkout(c, String(plan._id));
    await razorpayWebhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: data.checkout.orderId, amount: plan.priceMinor, currency: 'INR', status: 'failed', error_description: 'Card declined' } } } });
    const p = await PaymentModel.findOne({ orderId: data.checkout.orderId }).lean();
    expect(p).toMatchObject({ status: 'failed', failureReason: 'Card declined' });
  });
});

describe('admin payment operations', () => {
  it('records an offline payment with an audit trail and refunds it', async () => {
    const { c: admin } = await loginAs('admin');
    const member = await createUser('member');
    const plan = await createPlan({ priceMinor: 300000 });
    const res = await admin.post('/api/v1/payments/offline').send({ userId: String(member._id), planId: String(plan._id), method: 'cash', reference: 'DESK-42' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('captured');
    expect(await MembershipModel.countDocuments({ user: member._id, status: 'active', source: 'offline' })).toBe(1);
    const { AuditLogModel } = await import('../src/models');
    expect(await AuditLogModel.countDocuments({ action: 'payment.offline_recorded' })).toBe(1);

    const refund = await admin.post(`/api/v1/payments/${res.body.data.id}/refund`).send({ reason: 'Moved city', cancelMembership: true });
    expect(refund.status).toBe(200);
    expect(refund.body.data.status).toBe('refunded');
    expect(await MembershipModel.countDocuments({ user: member._id, status: 'refunded' })).toBe(1);
    expect((await admin.post(`/api/v1/payments/${res.body.data.id}/refund`).send({ reason: 'again' })).status).toBe(409);
  });

  it('rewards the referrer once when a referred member first pays', async () => {
    const referrer = await createUser('member');
    const profile = await MemberProfileModel.findOne({ user: referrer._id }).lean();
    const { client } = await import('./helpers');
    const c = await client();
    const reg = await c.post('/api/v1/auth/register').send({ name: 'New Person', email: 'newbie@test.dev', password: 'GoodPassw0rd', referralCode: profile!.referralCode, acceptTerms: true });
    expect(reg.status).toBe(201);
    const plan = await createPlan();
    for (let i = 0; i < 2; i++) {
      const d = await checkout(c, String(plan._id));
      const g = await payInSandbox(c, d.checkout.orderId);
      await c.post('/api/v1/payments/verify').send({ orderId: d.checkout.orderId, paymentId: g.paymentId, signature: g.signature });
    }
    expect(await LoyaltyTransactionModel.countDocuments({ user: referrer._id, reason: 'referral' })).toBe(1);
    expect((await MemberProfileModel.findOne({ user: referrer._id }))?.loyaltyPoints).toBe(200);
  });
});
