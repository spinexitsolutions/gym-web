import { Schema, model, type InferSchemaType } from 'mongoose';

export const PAYMENT_STATUSES = ['created', 'pending', 'captured', 'failed', 'refunded', 'partially_refunded', 'expired'] as const;

const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    planName: { type: String, required: true },
    membership: { type: Schema.Types.ObjectId, ref: 'Membership' },
    provider: { type: String, enum: ['razorpay', 'sandbox', 'offline'], required: true },
    mode: { type: String, enum: ['new', 'renewal', 'upgrade'], default: 'new' },
    /** Provider order id (Razorpay order_xxx). */
    orderId: { type: String },
    /** Provider payment id (Razorpay pay_xxx) — unique so a payment is only recorded once. */
    providerPaymentId: { type: String },
    method: { type: String, maxlength: 40 },
    baseAmountMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    couponCode: String,
    status: { type: String, enum: PAYMENT_STATUSES, default: 'created', index: true },
    verifiedVia: { type: String, enum: ['checkout', 'webhook', 'offline', 'reconcile'] },
    failureReason: { type: String, maxlength: 500 },
    capturedAt: Date,
    receiptNumber: { type: String },
    refund: {
      status: { type: String, enum: ['none', 'requested', 'processing', 'processed', 'failed'], default: 'none' },
      amountMinor: { type: Number, default: 0 },
      providerRefundId: String,
      reason: { type: String, maxlength: 500 },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      requestedAt: Date,
      processedAt: Date,
    },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reference: { type: String, maxlength: 120 },
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);
paymentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } });
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } });
paymentSchema.index({ receiptNumber: 1 }, { unique: true, partialFilterExpression: { receiptNumber: { $type: 'string' } } });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ capturedAt: -1 });

export type Payment = InferSchemaType<typeof paymentSchema>;
export const PaymentModel = model('Payment', paymentSchema);
