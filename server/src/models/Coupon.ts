import { Schema, model, type InferSchemaType } from 'mongoose';

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, maxlength: 200 },
    type: { type: String, enum: ['percent', 'flat'], required: true },
    /** Percent (1–100) or flat amount in minor units. */
    value: { type: Number, required: true, min: 1 },
    maxDiscountMinor: { type: Number, min: 0 },
    minAmountMinor: { type: Number, min: 0, default: 0 },
    validFrom: Date,
    validUntil: Date,
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, min: 1, default: 1 },
    plans: [{ type: Schema.Types.ObjectId, ref: 'MembershipPlan' }],
    newMembersOnly: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    campaign: { type: String, maxlength: 60 },
  },
  { timestamps: true },
);

export type Coupon = InferSchemaType<typeof couponSchema>;
export const CouponModel = model('Coupon', couponSchema);

const couponRedemptionSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    discountMinor: { type: Number, required: true },
  },
  { timestamps: true },
);
couponRedemptionSchema.index({ coupon: 1, user: 1 });
export const CouponRedemptionModel = model('CouponRedemption', couponRedemptionSchema);
