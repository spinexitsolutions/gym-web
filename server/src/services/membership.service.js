import { Membership, Payment, MembershipPlan, MemberProfile, Coupon, User, nextSequence } from '../models/index.js';
import { BILLING_PERIODS } from '../models/MembershipPlan.js';
import { addMonths } from '../utils/dates.js';
import { randomToken } from '../utils/crypto.js';
import { notify } from './notification.service.js';
import { sendEmail, receiptEmail } from './email.service.js';
import { renderInvoice } from './invoice.service.js';

export async function currentMembership(userId) {
  const now = new Date();
  return Membership.findOne({ user: userId, status: 'active', startDate: { $lte: now }, endDate: { $gte: now } })
    .sort('-endDate')
    .populate('plan');
}

// Creates the membership period. Renewals start when the current period ends (no lost days).
export async function createMembership({ userId, planId, period, payment, assignedBy, startDate }) {
  const months = BILLING_PERIODS[period];
  const latest = await Membership.findOne({ user: userId, status: { $in: ['active', 'pending'] }, endDate: { $gt: new Date() } }).sort('-endDate');
  const start = startDate ? new Date(startDate) : latest ? latest.endDate : new Date();
  const status = start <= new Date() ? 'active' : 'pending';
  return Membership.create({
    user: userId,
    plan: planId,
    period,
    startDate: start,
    endDate: addMonths(start, months),
    status,
    amountPaidPaise: payment?.amountPaise || 0,
    payment: payment?._id,
    renewalOf: latest?._id,
    assignedBy,
  });
}

async function rewardReferrer(payment) {
  const firstPaid = await Payment.countDocuments({ user: payment.user, status: 'paid' });
  if (firstPaid !== 1) return;
  const profile = await MemberProfile.findOne({ user: payment.user }).select('referredBy');
  if (!profile?.referredBy) return;
  const code = `REF${randomToken(4).toUpperCase()}`;
  await Coupon.create({
    code, kind: 'referral', owner: profile.referredBy, discountType: 'percent', value: 10, maxDiscountPaise: 300000,
    perUserLimit: 1, usageLimit: 1, description: 'Referral reward: 10% off your next renewal',
    validTo: addMonths(new Date(), 6),
  });
  await notify(profile.referredBy, {
    type: 'membership', title: 'You earned a referral reward', email: true,
    body: `A friend you referred just joined. Use code ${code} for 10% off your next renewal (valid 6 months).`,
    link: '/dashboard/membership',
  });
}

/**
 * Marks a payment as paid exactly once and activates the membership. Safe to call from both the client
 * verification endpoint and the webhook: only the call that flips the status performs the side effects.
 */
export async function completePayment(paymentId, { razorpayPaymentId, method } = {}) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['created', 'pending', 'failed'] } },
    { $set: { status: 'paid', paidAt: new Date(), ...(razorpayPaymentId && { razorpayPaymentId }), ...(method && { method }) }, $unset: { failureReason: 1 } },
    { new: true },
  );
  if (!payment) return Payment.findById(paymentId); // already processed by another call

  // Only the call that flipped the status takes an invoice number, so numbering has no gaps.
  payment.invoiceNumber = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(await nextSequence('invoice')).padStart(5, '0')}`;
  await payment.save();

  if (payment.plan && !payment.membership) {
    const membership = await createMembership({ userId: payment.user, planId: payment.plan, period: payment.period, payment });
    payment.membership = membership._id;
    await payment.save();
  }
  if (payment.coupon) await Coupon.updateOne({ _id: payment.coupon }, { $inc: { usedCount: 1 } });

  const [user, plan] = await Promise.all([User.findById(payment.user), MembershipPlan.findById(payment.plan).select('name')]);
  await notify(payment.user, {
    type: 'payment', title: 'Payment successful', link: '/dashboard/payments',
    body: `Your ${plan?.name || ''} membership payment was received. Invoice ${payment.invoiceNumber}.`,
  });
  if (user) {
    renderInvoice(payment._id)
      .then((pdf) => sendEmail(receiptEmail(user, payment, plan?.name, pdf)))
      .catch((e) => console.error('Receipt email failed:', e.message));
  }
  rewardReferrer(payment).catch((e) => console.error('Referral reward failed:', e.message));
  return payment;
}
