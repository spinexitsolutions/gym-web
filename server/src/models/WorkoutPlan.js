import mongoose from 'mongoose';

// A personalised plan a trainer assigns to a member.
const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    sets: { type: Number, min: 1, max: 20 },
    reps: { type: String, trim: true, maxlength: 20 }, // '8-12', '30s'
    restSec: { type: Number, min: 0, max: 600 },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const workoutPlanSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutProgram' },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    goal: { type: String, trim: true, maxlength: 200 },
    startDate: Date,
    endDate: Date,
    days: [
      {
        _id: false,
        label: { type: String, trim: true, maxlength: 40 }, // 'Day 1 — Push'
        exercises: [exerciseSchema],
      },
    ],
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
  },
  { timestamps: true },
);

workoutPlanSchema.index({ member: 1, status: 1 });

export default mongoose.model('WorkoutPlan', workoutPlanSchema);
