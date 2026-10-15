import { Schema, model, type InferSchemaType } from 'mongoose';

export const MEMBERSHIP_STATUSES = ['upcoming', 'active', 'expired', 'cancelled', 'upgraded', 'refunded'] as const;

const membershipSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    planSnapshot: {
      name: { type: String, required: true },
      durationDays: { type: Number, required: true },
      priceMinor: { type: Number, required: true },
      isTrial: { type: Boolean, default: false },
    },
    status: { type: String, enum: MEMBERSHIP_STATUSES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    source: { type: String, enum: ['online', 'offline', 'admin', 'trial'], required: true },
    cancelledAt: Date,
    cancelReason: { type: String, maxlength: 500 },
    cancellationRequestedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
membershipSchema.index({ user: 1, status: 1, endDate: -1 });
membershipSchema.index({ status: 1, endDate: 1 });
// One membership per payment — protects against double activation.
membershipSchema.index({ payment: 1 }, { unique: true, partialFilterExpression: { payment: { $type: 'objectId' } } });

export type Membership = InferSchemaType<typeof membershipSchema>;
export const MembershipModel = model('Membership', membershipSchema);
