import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,30}$/ },
    description: { type: String, trim: true, maxlength: 200 },
    kind: { type: String, enum: ['promo', 'referral'], default: 'promo' },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 }, // percent (0-100) or paise
    maxDiscountPaise: { type: Number, min: 0 },
    minAmountPaise: { type: Number, min: 0, default: 0 },
    validFrom: Date,
    validTo: Date,
    usageLimit: { type: Number, min: 0 }, // empty = unlimited
    usedCount: { type: Number, min: 0, default: 0 },
    perUserLimit: { type: Number, min: 0, default: 1 },
    applicablePlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' }], // empty = all
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // referral coupons
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

couponSchema.path('value').validate(function validPercent(v) {
  return this.discountType !== 'percent' || v <= 100;
}, 'Percent discount cannot exceed 100');

export default mongoose.model('Coupon', couponSchema);
