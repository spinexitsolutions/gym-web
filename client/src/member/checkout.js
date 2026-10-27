import { api } from '../services/api.js';

let scriptPromise;
function loadRazorpay() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout for an order created by the server and resolves with the verified result.
 * Success is decided only by the server (/payments/verify), never by the browser callback alone.
 */
export async function payWithRazorpay(order, { brand, accent }) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: brand,
      description: `${order.quote.plan.name} membership`,
      prefill: order.prefill,
      theme: { color: accent },
      handler: async (resp) => {
        try {
          const res = await api.post('/payments/verify', { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
          resolve(res);
        } catch (err) { reject(err); }
      },
      modal: {
        ondismiss: () => {
          api.post(`/payments/${order.paymentId}/cancel`, { reason: 'Checkout closed' }).catch(() => {});
          reject(Object.assign(new Error('Payment was cancelled.'), { cancelled: true }));
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      api.post(`/payments/${order.paymentId}/cancel`, { reason: resp.error?.description }).catch(() => {});
      reject(new Error(resp.error?.description || 'Payment failed. No money was taken.'));
    });
    rzp.open();
  });
}
