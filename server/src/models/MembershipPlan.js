import mongoose from 'mongoose';
import { PUBLISH_STATUS } from './_shared.js';

export const BILLING_PERIODS = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

// All money is stored as integer paise (₹1 = 100 paise) to avoid floating-point errors and match Razorpay.
const priceOptionSchema = new mongoose.Schema(
  {
    period: { type: String, enum: Object.keys(BILLING_PERIODS), required: true },
    pricePaise: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 90, default: 0 },
  },
  { _id: false },
);

const membershipPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tier: { type: String, enum: ['basic', 'standard', 'premium', 'elite'], required: true },
    tagline: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    benefits: [{ type: String, trim: true, maxlength: 120 }],
    // Rows of the public comparison table: { label: 'Steam & sauna', value: 'Yes' | 'No' | '4 / month' }
    comparison: [
      {
        _id: false,
        label: { type: String, trim: true, maxlength: 80 },
        value: { type: String, trim: true, maxlength: 40 },
      },
    ],
    pricing: {
      type: [priceOptionSchema],
      validate: [(v) => v.length > 0, 'At least one price option is required'],
    },
    joiningFeePaise: { type: Number, min: 0, default: 0 },
    limits: {
      ptSessionsPerMonth: { type: Number, min: 0, default: 0 },
      classesPerWeek: { type: Number, min: 0, default: 0 }, // 0 = unlimited
      guestPassesPerMonth: { type: Number, min: 0, default: 0 },
    },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: PUBLISH_STATUS, default: 'draft', index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

membershipPlanSchema.index({ status: 1, isActive: 1, order: 1 });

export default mongoose.model('MembershipPlan', membershipPlanSchema);
