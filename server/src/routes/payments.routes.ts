import express, { Router } from 'express';
import { z } from 'zod';
import { isProd } from '../config/env';
import { hasPermission, requireAuth, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { PaymentModel, UserModel } from '../models';
import { audit } from '../services/audit.service';
import * as payments from '../services/payment.service';
import { paymentsStatus } from '../services/payments';
import { sandboxCompletePayment } from '../services/payments/sandbox.provider';
import { streamReceipt } from '../services/receipt.service';
import { AppError } from '../utils/AppError';
import { sendCsv } from '../utils/csv';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

/** Mounted before JSON parsing and CSRF (signature-verified server-to-server calls). */
export const webhookRouter = Router();
webhookRouter.post(
  '/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    const result = await payments.handleWebhook('razorpay', req.body as Buffer, req.get('x-razorpay-signature'), req.get('x-razorpay-event-id'));
    res.json({ ok: true, ...result });
  }),
);
if (!isProd) {
  webhookRouter.post(
    '/sandbox',
    express.raw({ type: 'application/json', limit: '1mb' }),
    asyncHandler(async (req, res) => {
      const result = await payments.handleWebhook('sandbox', req.body as Buffer, req.get('x-razorpay-signature'), req.get('x-razorpay-event-id'));
      res.json({ ok: true, ...result });
    }),
  );
}

const r = Router();
r.use(requireAuth);

r.get('/status', requirePermission('payments:read'), (_req, res) => ok(res, paymentsStatus()));

r.post(
  '/quote',
  requireRole('member'),
  validate({ body: z.object({ planId: objectId, couponCode: z.string().trim().max(30).optional() }) }),
  asyncHandler(async (req, res) => {
    const q = await payments.quote(req.user!.id, req.body.planId, req.body.couponCode || undefined);
    ok(res, { planId: String(q.plan._id), planName: q.plan.name, baseAmountMinor: q.baseAmountMinor, discountMinor: q.discountMinor, amountMinor: q.amountMinor, currency: q.currency, couponCode: q.coupon?.code ?? null });
  }),
);

/** Creates a provider order. Amount is computed on the server from the plan + coupon. */
r.post(
  '/checkout',
  requireRole('member'),
  validate({ body: z.object({ planId: objectId, couponCode: z.string().trim().max(30).optional(), mode: z.enum(['auto', 'upgrade']).default('auto') }) }),
  asyncHandler(async (req, res) => {
    created(res, await payments.createCheckout(req.user!.id, { planId: req.body.planId, couponCode: req.body.couponCode || undefined, mode: req.body.mode }));
  }),
);

r.post(
  '/verify',
  requireRole('member'),
  validate({ body: z.object({ orderId: z.string().min(5).max(100), paymentId: z.string().min(5).max(100), signature: z.string().min(10).max(200) }) }),
  asyncHandler(async (req, res) => ok(res, await payments.verifyCheckout(req.user!.id, req.body))),
);

/** Records a checkout the member dismissed or that failed in the provider UI. */
r.post(
  '/failed',
  requireRole('member'),
  validate({ body: z.object({ orderId: z.string().min(5).max(100), reason: z.string().trim().max(300).default('Payment was not completed') }) }),
  asyncHandler(async (req, res) => {
    const p = await PaymentModel.findOne({ orderId: req.body.orderId, user: req.user!.id }).select('_id').lean();
    if (!p) throw AppError.notFound('Payment');
    await payments.markFailed(req.body.orderId, req.body.reason);
    ok(res, { recorded: true });
  }),
);

/** DEV ONLY: simulates the gateway's hosted checkout for PAYMENT_PROVIDER=sandbox. */
r.post(
  '/sandbox/complete',
  requireRole('member'),
  validate({ body: z.object({ orderId: z.string().startsWith('order_sbx_'), outcome: z.enum(['success', 'failure']).default('success') }) }),
  asyncHandler(async (req, res) => {
    if (isProd) throw AppError.notFound('Route');
    const p = await PaymentModel.findOne({ orderId: req.body.orderId, user: req.user!.id, provider: 'sandbox' });
    if (!p) throw AppError.notFound('Payment');
    ok(res, { orderId: p.orderId, ...sandboxCompletePayment(p.orderId!, p.amountMinor, p.currency, req.body.outcome) });
  }),
);

r.get(
  '/me',
  asyncHandler(async (req, res) => {
    const items = await PaymentModel.find({ user: req.user!.id, status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(100).lean();
    ok(res, items.map(payments.paymentView));
  }),
);

r.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const p = await PaymentModel.findById(req.params.id).lean();
    if (!p || (String(p.user) !== req.user!.id && !hasPermission(req.user, 'payments:read'))) throw AppError.notFound('Receipt');
    if (!p.receiptNumber || !p.capturedAt) throw AppError.conflict('A receipt is available once the payment is confirmed');
    const u = await UserModel.findById(p.user).select('name email').lean();
    await streamReceipt(res, {
      receiptNumber: p.receiptNumber,
      capturedAt: p.capturedAt,
      memberName: u?.name ?? 'Member',
      memberEmail: u?.email ?? '',
      planName: p.planName,
      baseAmountMinor: p.baseAmountMinor,
      discountMinor: p.discountMinor ?? 0,
      amountMinor: p.amountMinor,
      couponCode: p.couponCode,
      provider: p.provider,
      method: p.method,
      providerPaymentId: p.providerPaymentId,
      refundedMinor: p.refund?.amountMinor ?? 0,
    });
  }),
);

/* ---------------------------------- Admin --------------------------------- */

const adminList = listQuery.extend({
  status: z.enum(['created', 'pending', 'captured', 'failed', 'refunded', 'partially_refunded', 'expired']).optional(),
  provider: z.enum(['razorpay', 'sandbox', 'offline']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  user: objectId.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

r.get(
  '/',
  requirePermission('payments:read'),
  validate({ query: adminList }),
  asyncHandler(async (req, res) => {
    const { page, limit, q, status, provider, from, to, user, format } = res.locals.query as z.infer<typeof adminList>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (provider) filter.provider = provider;
    if (user) filter.user = user;
    if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    if (q) {
      const users = await UserModel.find({ $or: [{ email: { $regex: escapeRegex(q), $options: 'i' } }, { name: { $regex: escapeRegex(q), $options: 'i' } }] }).select('_id').limit(50).lean();
      filter.$or = [{ receiptNumber: q }, { orderId: q }, { providerPaymentId: q }, { user: { $in: users.map((u) => u._id) } }];
    }
    if (format === 'csv') {
      const rows = await PaymentModel.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(10000).lean();
      await audit(req, { action: 'payments.export', entity: 'Payment', summary: `Exported ${rows.length} payments` });
      return sendCsv(
        res,
        'payments.csv',
        ['date', 'receipt', 'member', 'email', 'plan', 'provider', 'method', 'status', 'amount_inr', 'discount_inr', 'refunded_inr', 'order_id', 'payment_id'],
        rows.map((p) => {
          const u = p.user as unknown as { name?: string; email?: string } | null;
          return [p.createdAt, p.receiptNumber, u?.name, u?.email, p.planName, p.provider, p.method, p.status, p.amountMinor / 100, (p.discountMinor ?? 0) / 100, (p.refund?.amountMinor ?? 0) / 100, p.orderId, p.providerPaymentId];
        }),
      );
    }
    const [items, total] = await Promise.all([PaymentModel.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PaymentModel.countDocuments(filter)]);
    ok(
      res,
      items.map((p) => ({ ...payments.paymentView(p), user: p.user })),
      pageMeta(page, limit, total),
    );
  }),
);

r.post(
  '/offline',
  requirePermission('payments:write'),
  validate({
    body: z.object({
      userId: objectId,
      planId: objectId,
      amountMinor: z.number().int().min(0).optional(),
      method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'complimentary']),
      reference: z.string().trim().max(120).optional(),
      notes: z.string().trim().max(1000).optional(),
      mode: z.enum(['auto', 'upgrade']).default('auto'),
      startDate: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => created(res, payments.paymentView(await payments.recordOfflinePayment(req, req.body)))),
);

r.post(
  '/:id/refund',
  requirePermission('payments:write'),
  validate({ body: z.object({ amountMinor: z.number().int().min(1).optional(), reason: z.string().trim().min(3).max(500), cancelMembership: z.boolean().default(false) }) }),
  asyncHandler(async (req, res) => ok(res, payments.paymentView(await payments.refundPayment(req, req.params.id, req.body)))),
);

export default r;
