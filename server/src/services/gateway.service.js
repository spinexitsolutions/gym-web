import crypto from 'node:crypto';
import env, { isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeEqual, randomToken } from '../utils/crypto.js';

const RZP = 'https://api.razorpay.com/v1';
export const razorpayConfigured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
// The sandbox exists only for local development/testing and can never activate in production.
export const sandboxEnabled = () => !isProd && env.PAYMENT_SANDBOX && !razorpayConfigured();
export const activeProvider = () => (razorpayConfigured() ? 'razorpay' : sandboxEnabled() ? 'sandbox' : null);

async function rzp(method, path, body) {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${RZP}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(502, `Payment gateway error: ${data?.error?.description || res.status}`);
  return data;
}

export async function createOrder({ amountPaise, receipt, notes }) {
  const provider = activeProvider();
  if (!provider) throw new ApiError(503, 'Online payments are not configured yet. Please pay at the front desk.');
  if (provider === 'sandbox') return { provider, orderId: `sandbox_order_${randomToken(10)}`, keyId: null };
  const order = await rzp('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes });
  return { provider, orderId: order.id, keyId: env.RAZORPAY_KEY_ID };
}

export const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

// Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!razorpayConfigured() || !orderId || !paymentId || !signature) return false;
  return safeEqual(hmac(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  return safeEqual(hmac(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
}

// Confirms with Razorpay that the payment is really captured for this order and amount.
export async function fetchPayment(paymentId) {
  return rzp('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export async function refundPayment({ provider, razorpayPaymentId, amountPaise, notes }) {
  if (provider === 'sandbox' || !razorpayPaymentId) return { id: `sandbox_refund_${randomToken(6)}`, status: 'processed' };
  return rzp('POST', `/payments/${encodeURIComponent(razorpayPaymentId)}/refund`, { amount: amountPaise, notes });
}
