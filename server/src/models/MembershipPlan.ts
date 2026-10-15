import { Schema, model, type InferSchemaType } from 'mongoose';

const membershipPlanSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    tagline: { type: String, maxlength: 140 },
    description: { type: String, maxlength: 2000 },
    durationDays: { type: Number, required: true, min: 1, max: 1830 },
    /** Price in minor units (paise). */
    priceMinor: { type: Number, required: true, min: 0 },
    /** Optional "was" price for promotions, minor units. */
    compareAtMinor: { type: Number, min: 0 },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    benefits: { type: [String], default: [] },
    limits: {
      classesPerWeek: { type: Number, min: 0, default: null },
      ptSessions: { type: Number, min: 0, default: 0 },
      guestPasses: { type: Number, min: 0, default: 0 },
    },
    isTrial: { type: Boolean, default: false },
    promoLabel: { type: String, maxlength: 40 },
    highlight: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
    /** Allow cancellation requests and the refund policy text shown to members. */
    cancellationPolicy: { type: String, maxlength: 1000 },
    refundableDays: { type: Number, min: 0, max: 60, default: 0 },
  },
  { timestamps: true },
);

export type MembershipPlan = InferSchemaType<typeof membershipPlanSchema>;
export const MembershipPlanModel = model('MembershipPlan', membershipPlanSchema);
