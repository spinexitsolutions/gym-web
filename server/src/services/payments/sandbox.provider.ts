import crypto from 'node:crypto';
import { env, isProd } from '../../config/env';
import { PaymentModel } from '../../models';
import { hmacSha256Hex, randomToken, safeEqual } from '../../utils/crypto';
import { AppError } from '../../utils/AppError';
import type { PaymentProvider } from './provider';

/**
 * LOCAL DEVELOPMENT ONLY. A simulated payment gateway that behaves like Razorpay's
 * signature scheme so the full server-side verification path can be exercised without
 * credentials. The server refuses to start with PAYMENT_PROVIDER=sandbox in production.
 *
 * The "gateway" step (POST /api/v1/payments/sandbox/complete) produces a payment id and a
 * signature with a secret derived from JWT_ACCESS_SECRET; the browser then calls the normal
 * /payments/verify endpoint, exactly like with Razorpay Checkout.
 */
export const sandboxSecret = () => hmacSha256Hex(env.JWT_ACCESS_SECRET, 'apex-sandbox-gateway');

export const sandboxProvider: PaymentProvider = {
  name: 'sandbox',
  publicConfig: () => ({ provider: 'sandbox' }),
  async createOrder({ amountMinor, currency }) {
    if (isProd) throw new AppError(500, 'SANDBOX_DISABLED', 'Sandbox payments are disabled in production');
    return { orderId: `order_sbx_${randomToken(10)}`, amountMinor, currency };
  },
  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    return safeEqual(hmacSha256Hex(sandboxSecret(), `${orderId}|${paymentId}`), signature);
  },
  verifyWebhookSignature(rawBody, signature) {
    return safeEqual(hmacSha256Hex(sandboxSecret(), rawBody), signature);
  },
  async fetchPayment(paymentId) {
    const pending = sandboxPayments.get(paymentId);
    if (pending) return pending;
    const p = await PaymentModel.findOne({ providerPaymentId: paymentId }).lean();
    if (!p) throw AppError.notFound('Sandbox payment');
    return { id: paymentId, orderId: p.orderId!, status: 'captured', amountMinor: p.amountMinor, currency: p.currency };
  },
  async capture(paymentId) {
    const p = sandboxPayments.get(paymentId);
    if (!p) throw AppError.notFound('Sandbox payment');
    p.status = 'captured';
    return p;
  },
  async refund(_paymentId, amountMinor) {
    return { id: `rfnd_sbx_${randomToken(8)}`, status: 'processed', amountMinor };
  },
};

/** In-memory record of simulated gateway payments (dev only). */
const sandboxPayments = new Map<string, Awaited<ReturnType<PaymentProvider['fetchPayment']>>>();

export function sandboxCompletePayment(orderId: string, amountMinor: number, currency: string, outcome: 'success' | 'failure') {
  const paymentId = `pay_sbx_${crypto.randomBytes(8).toString('hex')}`;
  sandboxPayments.set(paymentId, {
    id: paymentId,
    orderId,
    status: outcome === 'success' ? 'captured' : 'failed',
    amountMinor,
    currency,
    method: 'sandbox',
    errorDescription: outcome === 'failure' ? 'Simulated card decline' : undefined,
  });
  const signature = hmacSha256Hex(sandboxSecret(), `${orderId}|${paymentId}`);
  return { paymentId, signature };
}
