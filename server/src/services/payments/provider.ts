export interface ProviderOrder {
  orderId: string;
  amountMinor: number;
  currency: string;
}

export interface ProviderPayment {
  id: string;
  orderId: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amountMinor: number;
  currency: string;
  method?: string;
  errorDescription?: string;
}

export interface ProviderRefund {
  id: string;
  status: 'pending' | 'processed' | 'failed';
  amountMinor: number;
}

export interface PaymentProvider {
  name: 'razorpay' | 'sandbox';
  /** Values safe to send to the browser (never secrets). */
  publicConfig(): { provider: 'razorpay' | 'sandbox'; keyId?: string };
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<ProviderOrder>;
  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  capture(paymentId: string, amountMinor: number, currency: string): Promise<ProviderPayment>;
  refund(paymentId: string, amountMinor: number, notes: Record<string, string>): Promise<ProviderRefund>;
}
