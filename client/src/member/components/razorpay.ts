/** Minimal typing for Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/). */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
export interface RazorpayFailure {
  error: { code?: string; description?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } };
}
export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (r: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
}
export interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: RazorpayFailure) => void): void;
}
type RazorpayCtor = new (opts: RazorpayOptions) => RazorpayInstance;

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<RazorpayCtor> | null = null;

/** Loads Razorpay's checkout.js once and resolves its constructor. */
export function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (!loading) {
    loading = new Promise<RazorpayCtor>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Payment gateway failed to initialise')));
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('Couldn’t load the payment gateway. Check your connection (or disable content blockers) and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}
