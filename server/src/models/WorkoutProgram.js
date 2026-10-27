import mongoose from 'mongoose';
import { imageSchema } from './_shared.js';

export const PROGRAM_CATEGORIES = [
  'weight_loss', 'muscle_building', 'strength', 'personal_training', 'functional',
  'hiit', 'yoga', 'cardio', 'beginner',
];

const workoutProgramSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: String, enum: PROGRAM_CATEGORIES, required: true, index: true },
    summary: { type: String, trim: true, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 5000 },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    durationWeeks: { type: Number, min: 1, max: 104, required: true },
    sessionsPerWeek: { type: Number, min: 1, max: 14, default: 3 },
    sessionLengthMin: { type: Number, min: 10, max: 240, default: 60 },
    highlights: [{ type: String, trim: true, maxlength: 120 }],
    image: imageSchema,
    trainers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' }],
    eligiblePlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' }],
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

workoutProgramSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('WorkoutProgram', workoutProgramSchema);
