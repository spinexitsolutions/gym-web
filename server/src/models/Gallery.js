import mongoose from 'mongoose';
import { imageSchema } from './_shared.js';

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 120 },
    caption: { type: String, trim: true, maxlength: 300 },
    category: {
      type: String,
      enum: ['gym', 'facility', 'equipment', 'event', 'transformation'],
      default: 'gym',
      index: true,
    },
    image: imageSchema,
    // Transformation stories use a before/after pair and require recorded member consent to publish.
    beforeImage: imageSchema,
    afterImage: imageSchema,
    memberName: { type: String, trim: true, maxlength: 80 },
    durationLabel: { type: String, trim: true, maxlength: 40 },
    consentConfirmed: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

gallerySchema.pre('validate', function requireConsent(next) {
  if (this.category === 'transformation' && this.isPublished && !this.consentConfirmed) {
    this.invalidate('isPublished', 'Transformation photos need confirmed member consent before publishing');
  }
  next();
});

gallerySchema.index({ category: 1, isPublished: 1, order: 1 });

export default mongoose.model('Gallery', gallerySchema);
