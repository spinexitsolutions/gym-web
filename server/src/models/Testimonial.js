import mongoose from 'mongoose';
import { imageSchema } from './_shared.js';

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    headline: { type: String, trim: true, maxlength: 120 }, // 'Lost 14 kg in 6 months'
    quote: { type: String, required: true, trim: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    photo: imageSchema,
    memberSince: { type: String, trim: true, maxlength: 20 },
    consentConfirmed: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false }, // seed/sample content flag
    isPublished: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

testimonialSchema.pre('validate', function requireConsent(next) {
  if (this.isPublished && !this.consentConfirmed && !this.isDemo) {
    this.invalidate('isPublished', 'A testimonial can be published only after the member has given consent');
  }
  next();
});

testimonialSchema.index({ isPublished: 1, order: 1 });

export default mongoose.model('Testimonial', testimonialSchema);
