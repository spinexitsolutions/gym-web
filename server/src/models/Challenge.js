import mongoose from 'mongoose';
import { imageSchema } from './_shared.js';

// Events and fitness challenges. Challenges with a metric power the leaderboard.
const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    kind: { type: String, enum: ['event', 'challenge'], default: 'event' },
    description: { type: String, trim: true, maxlength: 3000 },
    image: imageSchema,
    location: { type: String, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    metric: { type: String, enum: ['none', 'attendance', 'manual'], default: 'none' },
    unit: { type: String, trim: true, maxlength: 20 },
    participants: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        score: { type: Number, default: 0 },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

challengeSchema.index({ isPublished: 1, startDate: 1 });

export default mongoose.model('Challenge', challengeSchema);
