import mongoose from 'mongoose';
import { imageSchema } from './_shared.js';

const slotSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false },
);

const trainerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true }, // login account
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    title: { type: String, trim: true, maxlength: 80 },
    photo: imageSchema,
    bio: { type: String, trim: true, maxlength: 2000 },
    specializations: [{ type: String, trim: true, maxlength: 60 }],
    qualifications: [{ type: String, trim: true, maxlength: 120 }],
    certifications: [
      {
        _id: false,
        name: { type: String, trim: true, maxlength: 120 },
        issuer: { type: String, trim: true, maxlength: 120 },
        year: { type: Number, min: 1970, max: 2100 },
      },
    ],
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    languages: [{ type: String, trim: true, maxlength: 30 }],
    availability: [slotSchema],
    sessionDurationMin: { type: Number, min: 15, max: 180, default: 60 },
    ptPricePaise: { type: Number, min: 0, default: 0 },
    social: { instagram: String, linkedin: String },
    rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

trainerSchema.index({ isActive: 1, order: 1 });
trainerSchema.index({ specializations: 1 });
trainerSchema.index({ name: 'text', bio: 'text', specializations: 'text' });

export default mongoose.model('Trainer', trainerSchema);
