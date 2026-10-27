import { z } from 'zod';
import { Payment, User, MembershipPlan } from '../models/index.js';
import { quote, publicQuote } from '../services/pricing.service.js';
import { completePayment, createMembership } from '../services/membership.service.js';
import * as gateway from '../services/gateway.service.js';
import { renderInvoice } from '../services/invoice.service.js';
import { notify, notifyStaff } from '../services/notification.service.js';
import { audit } from '../services/audit.service.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex, oid } from '../utils/pagination.js';
import { sendCsv } from '../utils/csv.js';
import { objectId } from '../validators/common.js';

const STAFF = ['owner', 'admin', 'staff'];
const isStaff = (u) => STAFF.includes(u.role);

export const purchaseSchema = z.object({
  planId: objectId,
  period: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']),
  couponCode: z.string().trim().max(30).optional().or(z.literal('').transform(() => undefined)),
});

export async function getQuote(req, res) {
  const q = await quote({ userId: req.user._id, ...req.body });
  return ok(res, publicQuote(q));
}

export async function createOrder(req, res) {
  if (!req.user.emailVerified) throw ApiError.forbidden('Please verify your email address before purchasing a membership');
  const q = await quote({ userId: req.user._id, ...req.body });
  const payment = await Payment.create({
    user: req.user._id, plan: q.plan._id, period: q.period, purpose: q.isRenewal ? 'renewal' : 'membership',
    basePaise: q.basePaise, joiningFeePaise: q.joiningFeePaise, discountPaise: q.discountPaise, amountPaise: q.amountPaise,
    coupon: q.coupon?._id, status: 'created',
  });

  if (q.amountPaise === 0) { // 100% coupon: nothing to collect
    const done = await completePayment(payment._id, { method: 'complimentary' });
    return created(res, { completed: true, paymentId: done._id, quote: publicQuote(q) }, 'Membership activated');
  }
  const order = await gateway.createOrder({ amountPaise: q.amountPaise, receipt: String(payment._id), notes: { paymentId: String(payment._id), plan: q.plan.slug } });
  payment.razorpayOrderId = order.orderId;
  payment.method = order.provider;
  await payment.save();
  return created(res, {
    paymentId: payment._id,
    provider: order.provider,
    orderId: order.orderId,
    keyId: order.keyId,
    amountPaise: q.amountPaise,
    currency: 'INR',
    quote: publicQuote(q),
    prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' },
  });
}

export const verifySchema = z.object({
  orderId: z.string().min(5).max(100),
  paymentId: z.string().max(100).optional(),
  signature: z.string().max(200).optional(),
});

export async function verify(req, res) {
  const { orderId, paymentId, signature } = req.body;
  const payment = await Payment.findOne({ razorpayOrderId: orderId, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'paid') return ok(res, { status: 'paid', paymentId: payment._id }, { message: 'Payment already confirmed' });

  if (payment.method === 'sandbox') {
    if (!gateway.sandboxEnabled()) throw ApiError.forbidden('Sandbox payments are disabled');
    const done = await completePayment(payment._id, { method: 'sandbox' });
    return ok(res, { status: done.status, paymentId: done._id }, { message: 'Sandbox payment confirmed (test mode)' });
  }

  if (!gateway.verifyCheckoutSignature({ orderId, paymentId, signature })) {
    payment.status = 'failed';
    payment.failureReason = 'Signature verification failed';
    await payment.save();
    throw ApiError.badRequest('Payment could not be verified. If money was deducted it will be confirmed automatically or refunded.');
  }
  // Defence in depth: confirm state and amount directly with Razorpay.
  const rp = await gateway.fetchPayment(paymentId);
  if (rp.order_id !== orderId || rp.amount !== payment.amountPaise) throw ApiError.badRequest('Payment details do not match the order');
  if (rp.status !== 'captured') {
    payment.status = 'pending';
    payment.razorpayPaymentId = paymentId;
    await payment.save();
    return ok(res, { status: 'pending', paymentId: payment._id }, { message: 'Payment received and awaiting confirmation from the bank' });
  }
  const done = await completePayment(payment._id, { razorpayPaymentId: paymentId });
  return ok(res, { status: done.status, paymentId: done._id }, { message: 'Payment successful — welcome aboard!' });
}

export async function cancelAttempt(req, res) {
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: 'created' },
    { status: 'failed', failureReason: String(req.body?.reason || 'Checkout closed').slice(0, 200) },
    { new: true },
  );
  return ok(res, { status: payment?.status || 'unchanged' });
}

// Razorpay webhook. Mounted with express.raw(); signature checked against the raw body.
export async function webhook(req, res) {
  const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
  if (!gateway.verifyWebhookSignature(raw, req.get('x-razorpay-signature'))) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
  const event = JSON.parse(raw);
  const entity = event.payload?.payment?.entity;
  if (event.event === 'payment.captured' && entity) {
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (payment && entity.amount === payment.amountPaise) await completePayment(payment._id, { razorpayPaymentId: entity.id });
  } else if (event.event === 'payment.failed' && entity) {
    await Payment.updateOne(
      { razorpayOrderId: entity.order_id, status: { $in: ['created', 'pending'] } },
      { status: 'failed', failureReason: String(entity.error_description || 'Payment failed').slice(0, 300) },
    );
  } else if (event.event === 'refund.processed') {
    const refund = event.payload?.refund?.entity;
    if (refund) {
      await Payment.updateOne(
        { razorpayPaymentId: refund.payment_id },
        { status: 'refunded', 'refund.razorpayRefundId': refund.id, 'refund.amountPaise': refund.amount, 'refund.processedAt': new Date() },
      );
    }
  }
  return res.json({ success: true });
}

export async function myPayments(req, res) {
  const items = await Payment.find({ user: req.user._id, status: { $ne: 'created' } })
    .populate('plan', 'name tier').sort('-createdAt').limit(100).lean();
  return ok(res, items);
}

export async function invoice(req, res) {
  const payment = await Payment.findById(req.params.id).select('user invoiceNumber');
  if (!payment) throw ApiError.notFound('Payment not found');
  if (String(payment.user) !== String(req.user._id) && !isStaff(req.user)) throw ApiError.forbidden();
  const pdf = await renderInvoice(payment._id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.invoiceNumber}.pdf"`);
  return res.send(pdf);
}

export async function requestRefund(req, res) {
  const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'paid') throw ApiError.badRequest('Only completed payments can be refunded');
  payment.status = 'refund_requested';
  payment.refund = { requestedAt: new Date(), reason: req.body.reason };
  await payment.save();
  await notifyStaff({ type: 'payment', title: 'Refund requested', body: `${req.user.name} requested a refund for ${payment.invoiceNumber}.`, link: '/admin/payments?status=refund_requested' });
  return ok(res, payment, { message: 'Refund request submitted. We will review it within 3 business days.' });
}

// ---- Staff ----

function paymentFilter(q) {
  const f = {};
  if (q.status) f.status = q.status;
  else f.status = { $ne: 'created' };
  if (q.plan) f.plan = oid(q.plan); // ObjectIds so the same filter works in aggregate() totals
  if (q.method) f.method = q.method;
  if (q.user) f.user = oid(q.user);
  if (q.from || q.to) {
    f.createdAt = {};
    if (q.from) f.createdAt.$gte = new Date(q.from);
    if (q.to) f.createdAt.$lte = new Date(`${q.to}T23:59:59.999Z`);
  }
  return f;
}

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(30).optional(),
  status: z.enum(['created', 'pending', 'paid', 'failed', 'refund_requested', 'refunded']).optional(),
  method: z.string().max(20).optional(),
  plan: objectId.optional(),
  user: objectId.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(100).optional(),
});

async function withSearch(filter, q) {
  if (!q) return filter;
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(200).lean();
  return { ...filter, $or: [{ user: { $in: users.map((u) => u._id) } }, { invoiceNumber: rx }, { razorpayPaymentId: rx }] };
}

export async function list(req, res) {
  const filter = await withSearch(paymentFilter(req.query), req.query.q);
  const opts = parsePagination(req.query, { sortable: ['createdAt', 'amountPaise', 'paidAt'] });
  const { items, meta } = await paginate(Payment, filter, opts, { populate: [{ path: 'user', select: 'name email' }, { path: 'plan', select: 'name' }] });
  const [totals] = await Payment.aggregate([
    { $match: filter },
    { $group: { _id: null, count: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amountPaise', 0] } }, refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$amountPaise', 0] } } } },
  ]);
  return ok(res, items, { meta: { ...meta, totals: totals || { count: 0, paid: 0, refunded: 0 } } });
}

export async function exportCsv(req, res) {
  const filter = await withSearch(paymentFilter(req.query), req.query.q);
  const rows = await Payment.find(filter).populate('user', 'name email').populate('plan', 'name').sort('-createdAt').limit(20000).lean();
  await audit(req, { action: 'payments.export', entity: 'Payment', summary: `${rows.length} rows` });
  return sendCsv(res, `payments-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    { label: 'Invoice', value: 'invoiceNumber' }, { label: 'Date', value: (r) => r.paidAt || r.createdAt },
    { label: 'Member', value: (r) => r.user?.name }, { label: 'Email', value: (r) => r.user?.email },
    { label: 'Plan', value: (r) => r.plan?.name }, { label: 'Period', value: 'period' }, { label: 'Status', value: 'status' },
    { label: 'Method', value: 'method' }, { label: 'Base (INR)', value: (r) => r.basePaise / 100 },
    { label: 'Joining fee (INR)', value: (r) => r.joiningFeePaise / 100 }, { label: 'Discount (INR)', value: (r) => r.discountPaise / 100 },
    { label: 'Amount (INR)', value: (r) => r.amountPaise / 100 }, { label: 'Razorpay payment', value: 'razorpayPaymentId' },
  ]);
}

export const refundSchema = z.object({
  amountPaise: z.coerce.number().int().min(100).optional(),
  decision: z.enum(['approve', 'reject']).default('approve'),
  note: z.string().trim().max(300).optional(),
});

export async function processRefund(req, res) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (!['paid', 'refund_requested'].includes(payment.status)) throw ApiError.badRequest('This payment cannot be refunded');

  if (req.body.decision === 'reject') {
    payment.status = 'paid';
    payment.set('refund.processedBy', req.user._id);
    payment.set('refund.processedAt', new Date());
    await payment.save();
    await notify(payment.user, { type: 'payment', title: 'Refund request declined', body: req.body.note || 'Please contact the front desk for details.', link: '/dashboard/payments', email: true });
    await audit(req, { action: 'payment.refund_reject', entity: 'Payment', entityId: payment._id });
    return ok(res, payment, { message: 'Refund request declined' });
  }

  const amountPaise = Math.min(req.body.amountPaise || payment.amountPaise, payment.amountPaise);
  const offline = ['cash', 'upi_offline', 'card_offline', 'complimentary'].includes(payment.method);
  const refund = offline ? { id: 'offline', status: 'processed' }
    : await gateway.refundPayment({ provider: payment.method, razorpayPaymentId: payment.razorpayPaymentId, amountPaise, notes: { by: String(req.user._id) } });
  payment.status = 'refunded';
  payment.set({ 'refund.amountPaise': amountPaise, 'refund.razorpayRefundId': refund.id, 'refund.processedAt': new Date(), 'refund.processedBy': req.user._id });
  await payment.save();
  await notify(payment.user, { type: 'payment', title: 'Refund processed', email: true, link: '/dashboard/payments',
    body: `A refund of INR ${(amountPaise / 100).toFixed(2)} for ${payment.invoiceNumber} has been processed. It may take 5–7 business days to reach your account.` });
  await audit(req, { action: 'payment.refund', entity: 'Payment', entityId: payment._id, summary: `Refunded ${amountPaise} paise`, changes: { note: req.body.note } });
  return ok(res, payment, { message: 'Refund processed' });
}

export const offlineSchema = z.object({
  userId: objectId,
  planId: objectId,
  period: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']),
  method: z.enum(['cash', 'upi_offline', 'card_offline', 'complimentary']),
  amountPaise: z.coerce.number().int().min(0).optional(), // defaults to the plan price
  note: z.string().trim().max(300).optional(),
});

export async function recordOffline(req, res) {
  const { userId, planId, period, method, note } = req.body;
  const user = await User.findOne({ _id: userId, role: 'member' });
  if (!user) throw ApiError.notFound('Member not found');
  const plan = await MembershipPlan.findById(planId);
  const option = plan?.pricing.find((p) => p.period === period);
  if (!option) throw ApiError.badRequest('Plan or period not found');
  const amountPaise = method === 'complimentary' ? 0 : req.body.amountPaise ?? option.pricePaise;
  const payment = await Payment.create({
    user: userId, plan: planId, period, purpose: 'membership', basePaise: option.pricePaise,
    discountPaise: Math.max(0, option.pricePaise - amountPaise), amountPaise, method, note, recordedBy: req.user._id, status: 'created',
  });
  const done = await completePayment(payment._id, { method });
  await audit(req, { action: 'payment.offline', entity: 'Payment', entityId: payment._id, summary: `${method} ${amountPaise} paise for ${user.email}` });
  return created(res, done, 'Payment recorded and membership activated');
}

export { createMembership };
