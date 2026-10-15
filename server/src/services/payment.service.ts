import type { Request } from 'express';
import type { ClientSession, Types } from 'mongoose';
import { withTransaction } from '../config/db';
import { logger } from '../config/logger';
import {
  CouponModel,
  CouponRedemptionModel,
  LoyaltyTransactionModel,
  MemberProfileModel,
  MembershipModel,
  MembershipPlanModel,
  PaymentModel,
  UserModel,
  WebhookEventModel,
  nextSequence,
} from '../models';
import { AppError } from '../utils/AppError';
import { formatMoney } from '@apex/shared';
import { audit } from './audit.service';
import { applyCoupon } from './coupon.service';
import { grantMembership, resolveMode, type MembershipMode } from './membership.service';
import { notifyAdmins, notifyLater } from './notification.service';
import { getProvider, getProviderByName } from './payments';
import type { ProviderPayment } from './payments/provider';
import { getSiteSettings } from './settings.service';
import { env } from '../config/env';

/* --------------------------------- Pricing -------------------------------- */

/** Computes the price for a plan entirely on the server. Prices from the browser are never used. */
export async function quote(userId: string, planId: string, couponCode?: string) {
  const plan = await MembershipPlanModel.findById(planId);
  if (!plan || !plan.active) throw AppError.notFound('Membership plan');
  if (plan.isTrial) await assertTrialEligible(userId);
  let discountMinor = 0;
  let coupon = null;
  if (couponCode) {
    const applied = await applyCoupon(couponCode, userId, plan);
    discountMinor = applied.discountMinor;
    coupon = applied.coupon;
  }
  return { plan, coupon, baseAmountMinor: plan.priceMinor, discountMinor, amountMinor: plan.priceMinor - discountMinor, currency: plan.currency };
}

async function assertTrialEligible(userId: string) {
  const [profile, hadTrial] = await Promise.all([
    MemberProfileModel.findOne({ user: userId }).select('trialUsed').lean(),
    MembershipModel.exists({ user: userId, 'planSnapshot.isTrial': true }),
  ]);
  if (profile?.trialUsed || hadTrial) throw AppError.conflict('You have already used your trial membership');
}

/* -------------------------------- Checkout -------------------------------- */

export async function createCheckout(userId: string, input: { planId: string; couponCode?: string; mode: 'auto' | 'upgrade' }) {
  const q = await quote(userId, input.planId, input.couponCode);
  const mode = await resolveMode(userId, input.mode);
  const user = await UserModel.findById(userId).select('name email phone').lean();
  if (!user) throw AppError.unauthorized();

  // Free (100% coupon / free trial): no gateway involved, activate immediately.
  if (q.amountMinor === 0) {
    const payment = await PaymentModel.create({
      user: userId,
      plan: q.plan._id,
      planName: q.plan.name,
      provider: 'offline',
      method: 'complimentary',
      mode,
      baseAmountMinor: q.baseAmountMinor,
      discountMinor: q.discountMinor,
      amountMinor: 0,
      coupon: q.coupon?._id,
      couponCode: q.coupon?.code,
      status: 'pending',
      verifiedVia: 'offline',
    });
    const result = await capturePayment({ paymentDocId: payment._id, via: 'offline', source: q.plan.isTrial ? 'trial' : 'admin' });
    return { free: true as const, payment: paymentView(result.payment), membershipId: String(result.payment.membership) };
  }

  const provider = getProvider();
  const payment = await PaymentModel.create({
    user: userId,
    plan: q.plan._id,
    planName: q.plan.name,
    provider: provider.name,
    mode,
    baseAmountMinor: q.baseAmountMinor,
    discountMinor: q.discountMinor,
    amountMinor: q.amountMinor,
    currency: q.currency,
    coupon: q.coupon?._id,
    couponCode: q.coupon?.code,
    status: 'created',
  });
  try {
    const order = await provider.createOrder({
      amountMinor: q.amountMinor,
      currency: q.currency,
      receipt: String(payment._id),
      notes: { paymentId: String(payment._id), userId, planId: String(q.plan._id) },
    });
    payment.orderId = order.orderId;
    await payment.save();
    const settings = await getSiteSettings();
    return {
      free: false as const,
      payment: paymentView(payment),
      checkout: {
        ...provider.publicConfig(),
        orderId: order.orderId,
        amountMinor: order.amountMinor,
        currency: order.currency,
        name: settings.brand.name,
        description: `${q.plan.name} membership`,
        prefill: { name: user.name, email: user.email, contact: user.phone ?? '' },
      },
    };
  } catch (err) {
    payment.status = 'failed';
    payment.failureReason = 'Could not create payment order';
    await payment.save();
    throw err;
  }
}

/**
 * Called by the browser after the provider's checkout returns. The membership is only
 * activated after the signature is verified AND the payment is confirmed with the provider.
 */
export async function verifyCheckout(userId: string, input: { orderId: string; paymentId: string; signature: string }) {
  const payment = await PaymentModel.findOne({ orderId: input.orderId, user: userId });
  if (!payment) throw AppError.notFound('Payment');
  if (['captured', 'refunded', 'partially_refunded'].includes(payment.status)) return { payment: paymentView(payment), alreadyProcessed: true };
  const provider = getProviderByName(payment.provider);
  if (!provider.verifyCheckoutSignature(input)) {
    await PaymentModel.updateOne({ _id: payment._id, status: { $in: ['created', 'pending'] } }, { $set: { failureReason: 'Signature verification failed' } });
    throw AppError.badRequest('Payment verification failed. If money was deducted it will be reconciled automatically.');
  }
  let remote = await provider.fetchPayment(input.paymentId);
  if (remote.orderId !== payment.orderId) throw AppError.badRequest('Payment does not belong to this order');
  if (remote.status === 'authorized') remote = await provider.capture(remote.id, payment.amountMinor, payment.currency);
  if (remote.status === 'failed') {
    await markFailed(payment.orderId!, remote.errorDescription ?? 'Payment failed', remote.id);
    throw AppError.badRequest(remote.errorDescription ?? 'Payment failed');
  }
  if (remote.status !== 'captured') {
    await PaymentModel.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'pending', providerPaymentId: remote.id } });
    return { payment: paymentView((await PaymentModel.findById(payment._id))!), alreadyProcessed: false, pending: true };
  }
  const result = await capturePayment({ orderId: payment.orderId!, remote, via: 'checkout' });
  return { payment: paymentView(result.payment), alreadyProcessed: result.alreadyProcessed };
}

/**
 * Idempotent capture + activation. Safe to call concurrently from checkout verification
 * and webhooks: an atomic status transition guarantees exactly one caller activates.
 */
export async function capturePayment(input: {
  orderId?: string;
  paymentDocId?: Types.ObjectId;
  remote?: ProviderPayment;
  via: 'checkout' | 'webhook' | 'offline' | 'reconcile';
  source?: 'online' | 'offline' | 'admin' | 'trial';
  createdBy?: string;
  startDate?: Date;
}) {
  const filter = input.paymentDocId ? { _id: input.paymentDocId } : { orderId: input.orderId };
  // Amount check happens outside the transaction so the "flagged" state is persisted.
  if (input.remote) {
    const pre = await PaymentModel.findOne(filter).select('amountMinor currency status').lean();
    if (!pre) throw AppError.notFound('Payment');
    if (!['captured', 'refunded', 'partially_refunded'].includes(pre.status) && (input.remote.amountMinor !== pre.amountMinor || input.remote.currency !== pre.currency)) {
      await PaymentModel.updateOne({ _id: pre._id, status: { $in: ['created', 'pending'] } }, { $set: { status: 'failed', failureReason: 'Amount mismatch — flagged for review', providerPaymentId: input.remote.id } });
      logger.error({ payment: String(pre._id) }, 'Payment amount mismatch');
      throw AppError.badRequest('Payment amount mismatch');
    }
  }
  const result = await withTransaction(async (session) => {
    const existing = await PaymentModel.findOne(filter).session(session ?? null);
    if (!existing) throw AppError.notFound('Payment');
    if (['captured', 'refunded', 'partially_refunded'].includes(existing.status)) return { payment: existing, alreadyProcessed: true };
    const receiptNumber = await nextReceiptNumber(session);
    const claimed = await PaymentModel.findOneAndUpdate(
      { _id: existing._id, status: { $in: ['created', 'pending', 'failed'] }, failureReason: { $not: /mismatch/i } },
      {
        $set: {
          status: 'captured',
          capturedAt: new Date(),
          verifiedVia: input.via,
          receiptNumber,
          ...(input.remote ? { providerPaymentId: input.remote.id, method: input.remote.method } : {}),
        },
        $unset: { failureReason: 1 },
      },
      { new: true, session },
    );
    if (!claimed) {
      const current = await PaymentModel.findById(existing._id).session(session ?? null);
      return { payment: current!, alreadyProcessed: true };
    }
    const mode = claimed.mode as MembershipMode;
    const membership = await grantMembership(
      {
        userId: claimed.user,
        planId: claimed.plan,
        mode,
        source: input.source ?? (claimed.provider === 'offline' ? 'offline' : 'online'),
        paymentId: claimed._id,
        createdBy: input.createdBy,
        startDate: input.startDate,
      },
      session,
    );
    claimed.membership = membership._id;
    await claimed.save({ session });

    if (claimed.coupon) {
      await CouponRedemptionModel.create([{ coupon: claimed.coupon, user: claimed.user, payment: claimed._id, discountMinor: claimed.discountMinor }], { session });
      await CouponModel.updateOne({ _id: claimed.coupon }, { $inc: { usedCount: 1 } }, { session });
    }
    if (membership.planSnapshot?.isTrial) {
      await MemberProfileModel.updateOne({ user: claimed.user }, { $set: { trialUsed: true } }, { session });
    }
    await awardReferral(claimed.user, session);
    return { payment: claimed, alreadyProcessed: false };
  });

  if (!result.alreadyProcessed) {
    const p = result.payment;
    notifyLater({
      userId: p.user,
      type: 'payment',
      title: p.amountMinor > 0 ? `Payment received — ${formatMoney(p.amountMinor)}` : 'Membership activated',
      body: `Your ${p.planName} membership is confirmed. Receipt ${p.receiptNumber}.`,
      link: '/member/payments',
      dedupeKey: `payment-captured:${p._id}`,
      transactional: true,
      whatsapp: true,
    });
  }
  return result;
}

async function nextReceiptNumber(_session?: ClientSession) {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`receipt-${year}`);
  return `APX-${year}-${String(seq).padStart(6, '0')}`;
}

/** Rewards the referrer once, the first time a referred member pays. */
async function awardReferral(userId: Types.ObjectId, session?: ClientSession) {
  const profile = await MemberProfileModel.findOne({ user: userId }).select('referredBy').session(session ?? null);
  if (!profile?.referredBy) return;
  const settings = await getSiteSettings();
  if (!settings.loyalty.enabled || settings.loyalty.referralRewardPoints <= 0) return;
  const key = `referral:${userId}`;
  const exists = await LoyaltyTransactionModel.exists({ key }).session(session ?? null);
  if (exists) return;
  await LoyaltyTransactionModel.create([{ user: profile.referredBy, points: settings.loyalty.referralRewardPoints, reason: 'referral', key, note: 'Referral reward' }], { session });
  await MemberProfileModel.updateOne({ user: profile.referredBy }, { $inc: { loyaltyPoints: settings.loyalty.referralRewardPoints } }, { session });
}

export async function markFailed(orderId: string, reason: string, providerPaymentId?: string) {
  await PaymentModel.updateOne(
    { orderId, status: { $in: ['created', 'pending'] } },
    { $set: { status: 'failed', failureReason: reason.slice(0, 500), ...(providerPaymentId ? { providerPaymentId } : {}) } },
  );
}

/* -------------------------------- Webhooks -------------------------------- */

interface RazorpayWebhook {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
  };
}

/** Verifies and processes a provider webhook exactly once per event id. */
export async function handleWebhook(providerName: string, rawBody: Buffer, signature: string | undefined, eventIdHeader: string | undefined) {
  const provider = getProviderByName(providerName);
  if (!signature || !provider.verifyWebhookSignature(rawBody, signature)) throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook;
  const eventId = eventIdHeader || `${body.event}:${body.payload.payment?.entity.id ?? body.payload.refund?.entity.id ?? ''}`;

  try {
    await WebhookEventModel.create({ provider: providerName, eventId, type: body.event });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const prev = await WebhookEventModel.findOne({ provider: providerName, eventId });
    if (prev && prev.status !== 'failed') return { duplicate: true };
    await WebhookEventModel.updateOne({ _id: prev!._id }, { $set: { status: 'processing' }, $unset: { error: 1 } });
  }

  try {
    let status: 'processed' | 'ignored' = 'processed';
    const pay = body.payload.payment?.entity;
    switch (body.event) {
      case 'payment.captured':
      case 'order.paid': {
        if (!pay) break;
        const exists = await PaymentModel.exists({ orderId: pay.order_id });
        if (!exists) {
          status = 'ignored';
          break;
        }
        await capturePayment({
          orderId: pay.order_id,
          via: 'webhook',
          remote: { id: pay.id, orderId: pay.order_id, status: 'captured', amountMinor: pay.amount, currency: pay.currency, method: pay.method },
        });
        break;
      }
      case 'payment.failed':
        if (pay) await markFailed(pay.order_id, pay.error_description ?? 'Payment failed', pay.id);
        break;
      case 'refund.processed':
      case 'refund.failed': {
        const rf = body.payload.refund?.entity;
        if (!rf) break;
        await PaymentModel.updateOne(
          { providerPaymentId: rf.payment_id, 'refund.providerRefundId': rf.id },
          { $set: { 'refund.status': body.event === 'refund.processed' ? 'processed' : 'failed', ...(body.event === 'refund.processed' ? { 'refund.processedAt': new Date() } : {}) } },
        );
        break;
      }
      default:
        status = 'ignored';
    }
    await WebhookEventModel.updateOne({ provider: providerName, eventId }, { $set: { status } });
    return { duplicate: false, status };
  } catch (err) {
    await WebhookEventModel.updateOne({ provider: providerName, eventId }, { $set: { status: 'failed', error: (err as Error).message.slice(0, 300) } });
    throw err;
  }
}

/* ------------------------------ Admin actions ----------------------------- */

export async function recordOfflinePayment(
  req: Request,
  input: { userId: string; planId: string; amountMinor?: number; method: string; reference?: string; notes?: string; mode: 'auto' | 'upgrade'; startDate?: Date },
) {
  const plan = await MembershipPlanModel.findById(input.planId);
  if (!plan) throw AppError.notFound('Membership plan');
  const user = await UserModel.findById(input.userId);
  if (!user || user.role !== 'member') throw AppError.notFound('Member');
  const amount = input.amountMinor ?? plan.priceMinor;
  if (amount > plan.priceMinor) throw AppError.validation('Amount cannot exceed the plan price', [{ path: 'body.amountMinor', message: 'Amount cannot exceed the plan price' }]);
  const mode = await resolveMode(input.userId, input.mode);
  const payment = await PaymentModel.create({
    user: user._id,
    plan: plan._id,
    planName: plan.name,
    provider: 'offline',
    method: input.method,
    mode,
    baseAmountMinor: plan.priceMinor,
    discountMinor: plan.priceMinor - amount,
    amountMinor: amount,
    status: 'pending',
    reference: input.reference,
    notes: input.notes,
    recordedBy: req.user!.id,
  });
  const result = await capturePayment({ paymentDocId: payment._id, via: 'offline', source: 'offline', createdBy: req.user!.id, startDate: input.startDate });
  await audit(req, {
    action: 'payment.offline_recorded',
    entity: 'Payment',
    entityId: payment._id,
    summary: `Recorded ${input.method} payment of ${formatMoney(amount)} for ${user.email} (${plan.name})`,
    changes: { reference: input.reference, amountMinor: amount, planId: input.planId },
  });
  return result.payment;
}

export async function refundPayment(req: Request, paymentId: string, input: { amountMinor?: number; reason: string; cancelMembership: boolean }) {
  const payment = await PaymentModel.findById(paymentId);
  if (!payment) throw AppError.notFound('Payment');
  if (!['captured', 'partially_refunded'].includes(payment.status)) throw AppError.conflict('Only captured payments can be refunded');
  if (payment.refund?.status && ['processing', 'requested'].includes(payment.refund.status)) throw AppError.conflict('A refund is already in progress');
  const already = payment.refund?.amountMinor ?? 0;
  const amount = input.amountMinor ?? payment.amountMinor - already;
  if (amount <= 0 || amount + already > payment.amountMinor) throw AppError.validation('Refund amount is invalid', [{ path: 'body.amountMinor', message: 'Refund exceeds the refundable amount' }]);

  let refundStatus: 'processed' | 'processing' | 'failed' = 'processed';
  let providerRefundId: string | undefined;
  if (payment.provider !== 'offline' && payment.amountMinor > 0) {
    const provider = getProviderByName(payment.provider);
    const r = await provider.refund(payment.providerPaymentId!, amount, { reason: input.reason.slice(0, 200), paymentId: String(payment._id) });
    providerRefundId = r.id;
    refundStatus = r.status === 'processed' ? 'processed' : r.status === 'failed' ? 'failed' : 'processing';
  }
  const total = already + amount;
  payment.refund = {
    status: refundStatus,
    amountMinor: total,
    providerRefundId,
    reason: input.reason,
    requestedBy: req.user!.id as unknown as Types.ObjectId,
    requestedAt: new Date(),
    processedAt: refundStatus === 'processed' ? new Date() : undefined,
  };
  if (refundStatus !== 'failed') payment.status = total >= payment.amountMinor ? 'refunded' : 'partially_refunded';
  await payment.save();

  if (input.cancelMembership && payment.membership) {
    await MembershipModel.updateOne(
      { _id: payment.membership, status: { $in: ['active', 'upcoming'] } },
      { $set: { status: 'refunded', cancelledAt: new Date(), cancelReason: input.reason, endDate: new Date() } },
    );
  }
  await audit(req, {
    action: 'payment.refund',
    entity: 'Payment',
    entityId: payment._id,
    summary: `Refund of ${formatMoney(amount)} (${refundStatus}) for receipt ${payment.receiptNumber}`,
    changes: { amountMinor: amount, reason: input.reason, cancelMembership: input.cancelMembership },
  });
  notifyLater({
    userId: payment.user,
    type: 'payment',
    title: 'Refund initiated',
    body: `A refund of ${formatMoney(amount)} for receipt ${payment.receiptNumber} has been ${refundStatus === 'processed' ? 'processed' : 'initiated'}.`,
    link: '/member/payments',
    dedupeKey: `refund:${payment._id}:${total}`,
    transactional: true,
  });
  return payment;
}

/** Marks unpaid orders as expired after PAYMENT_ORDER_TTL_MIN. */
export async function expireStaleOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.PAYMENT_ORDER_TTL_MIN * 60000);
  const r = await PaymentModel.updateMany({ status: 'created', createdAt: { $lt: cutoff } }, { $set: { status: 'expired' } });
  if (r.modifiedCount > 0) logger.info({ count: r.modifiedCount }, 'Expired stale payment orders');
  return { expired: r.modifiedCount };
}

export async function notifyFailedPaymentsDigest() {
  const since = new Date(Date.now() - 24 * 3600000);
  const count = await PaymentModel.countDocuments({ status: 'failed', updatedAt: { $gte: since } });
  if (count > 0) {
    await notifyAdmins({ type: 'payment', title: `${count} failed payment(s) in the last 24h`, body: 'Review them in Payments → Failed.', link: '/admin/payments?status=failed', dedupeKey: `failed-digest:${new Date().toISOString().slice(0, 10)}`, email: false });
  }
}

/* --------------------------------- Views ---------------------------------- */

export function paymentView(p: InstanceType<typeof PaymentModel> | (Record<string, unknown> & { _id: unknown })) {
  const x = p as unknown as Record<string, unknown> & { refund?: { status?: string; amountMinor?: number } };
  return {
    id: String(x._id),
    planName: x.planName,
    plan: x.plan ? String(x.plan) : null,
    membership: x.membership ? String(x.membership) : null,
    provider: x.provider,
    method: x.method ?? null,
    mode: x.mode,
    orderId: x.orderId ?? null,
    providerPaymentId: x.providerPaymentId ?? null,
    baseAmountMinor: x.baseAmountMinor,
    discountMinor: x.discountMinor,
    amountMinor: x.amountMinor,
    currency: x.currency,
    couponCode: x.couponCode ?? null,
    status: x.status,
    failureReason: x.failureReason ?? null,
    receiptNumber: x.receiptNumber ?? null,
    capturedAt: x.capturedAt ?? null,
    refund: x.refund ? { status: x.refund.status, amountMinor: x.refund.amountMinor } : null,
    createdAt: x.createdAt,
  };
}
