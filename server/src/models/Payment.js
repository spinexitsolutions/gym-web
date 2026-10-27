import mongoose from 'mongoose';

// Card data never touches this server: Razorpay Checkout collects it. A payment becomes 'paid' only after
// server-side signature verification or a verified webhook.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    period: String,
    purpose: { type: String, enum: ['membership', 'renewal', 'personal_training', 'other'], default: 'membership' },
    basePaise: { type: Number, min: 0, required: true },
    joiningFeePaise: { type: Number, min: 0, default: 0 },
    discountPaise: { type: Number, min: 0, default: 0 },
    amountPaise: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'INR' },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    status: {
      type: String,
      enum: ['created', 'pending', 'paid', 'failed', 'refund_requested', 'refunded'],
      default: 'created',
    },
    method: { type: String, enum: ['razorpay', 'cash', 'upi_offline', 'card_offline'], default: 'razorpay' },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    failureReason: { type: String, maxlength: 300 },
    invoiceNumber: { type: String, unique: true, sparse: true },
    paidAt: Date,
    refund: {
      requestedAt: Date,
      reason: { type: String, maxlength: 500 },
      amountPaise: Number,
      razorpayRefundId: String,
      processedAt: Date,
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // offline payments
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, paidAt: -1 });
paymentSchema.index({ plan: 1, paidAt: -1 });

export default mongoose.model('Payment', paymentSchema);
