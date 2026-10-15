import { env } from '../../config/env';
import { hmacSha256Hex, safeEqual } from '../../utils/crypto';
import { AppError } from '../../utils/AppError';
import type { PaymentProvider, ProviderPayment } from './provider';

const API = 'https://api.razorpay.com/v1';

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!res.ok) {
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', `Payment provider error: ${json.error?.description ?? res.status}`);
  }
  return json;
}

type RzpPayment = { id: string; order_id: string; status: string; amount: number; currency: string; method?: string; error_description?: string };
const mapPayment = (p: RzpPayment): ProviderPayment => ({
  id: p.id,
  orderId: p.order_id,
  status: (['created', 'authorized', 'captured', 'refunded', 'failed'].includes(p.status) ? p.status : 'created') as ProviderPayment['status'],
  amountMinor: p.amount,
  currency: p.currency,
  method: p.method,
  errorDescription: p.error_description,
});

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  publicConfig: () => ({ provider: 'razorpay', keyId: env.RAZORPAY_KEY_ID }),
  async createOrder({ amountMinor, currency, receipt, notes }) {
    const order = await call<{ id: string; amount: number; currency: string }>('/orders', {
      method: 'POST',
      body: { amount: amountMinor, currency, receipt, notes, payment_capture: 1 },
    });
    return { orderId: order.id, amountMinor: order.amount, currency: order.currency };
  },
  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const expected = hmacSha256Hex(env.RAZORPAY_KEY_SECRET!, `${orderId}|${paymentId}`);
    return safeEqual(expected, signature);
  },
  verifyWebhookSignature(rawBody, signature) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    return safeEqual(hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
  },
  async fetchPayment(paymentId) {
    return mapPayment(await call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`));
  },
  async capture(paymentId, amountMinor, currency) {
    return mapPayment(await call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', body: { amount: amountMinor, currency } }));
  },
  async refund(paymentId, amountMinor, notes) {
    const r = await call<{ id: string; status: string; amount: number }>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      body: { amount: amountMinor, notes, speed: 'normal' },
    });
    return { id: r.id, status: r.status === 'processed' ? 'processed' : r.status === 'failed' ? 'failed' : 'pending', amountMinor: r.amount };
  },
};
