import mongoose from 'mongoose';
import { BILLING_PERIODS } from './MembershipPlan.js';

const membershipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    period: { type: String, enum: Object.keys(BILLING_PERIODS), required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled', 'suspended'],
      default: 'pending',
    },
    amountPaidPaise: { type: Number, min: 0, default: 0 },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    renewalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set when staff assigns manually
    cancellation: {
      requestedAt: Date,
      reason: { type: String, maxlength: 500 },
      status: { type: String, enum: ['none', 'requested', 'approved', 'rejected'], default: 'none' },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decidedAt: Date,
    },
    remindersSent: [{ type: String }], // e.g. 'expiry-7d', 'expiry-1d'
  },
  { timestamps: true },
);

membershipSchema.index({ user: 1, status: 1, endDate: -1 });
membershipSchema.index({ status: 1, endDate: 1 });

export default mongoose.model('Membership', membershipSchema);
