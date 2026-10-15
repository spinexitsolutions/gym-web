import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import type { PaymentProvider } from './provider';
import { razorpayProvider } from './razorpay.provider';
import { sandboxProvider } from './sandbox.provider';

export function getProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'razorpay') return razorpayProvider;
  if (env.PAYMENT_PROVIDER === 'sandbox') return sandboxProvider;
  throw AppError.unavailable('Online payments are not configured yet. Please pay at the front desk or contact us.');
}

export function getProviderByName(name: string): PaymentProvider {
  if (name === 'razorpay') return razorpayProvider;
  if (name === 'sandbox') return sandboxProvider;
  throw AppError.badRequest('Unknown payment provider');
}

export function paymentsStatus() {
  return {
    provider: env.PAYMENT_PROVIDER,
    configured: env.PAYMENT_PROVIDER !== 'disabled',
    testMode: env.PAYMENT_PROVIDER === 'sandbox' || Boolean(env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')),
    webhookConfigured: env.PAYMENT_PROVIDER === 'sandbox' || Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  };
}
