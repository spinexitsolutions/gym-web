import { Schema, model, type InferSchemaType } from 'mongoose';

const planExerciseSchema = new Schema(
  {
    exercise: { type: Schema.Types.ObjectId, ref: 'Exercise' },
    name: { type: String, required: true, maxlength: 100 },
    sets: { type: Number, min: 1, max: 20, default: 3 },
    reps: { type: String, maxlength: 20, default: '10' },
    weightKg: { type: Number, min: 0, max: 1000 },
    restSec: { type: Number, min: 0, max: 900, default: 90 },
    tempo: { type: String, maxlength: 20 },
    notes: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const planDaySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    focus: { type: String, maxlength: 100 },
    exercises: { type: [planExerciseSchema], default: [] },
  },
  { _id: false },
);

const workoutPlanSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    member: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    trainer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isTemplate: { type: Boolean, default: false },
    days: { type: [planDaySchema], default: [] },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
);

export type WorkoutPlan = InferSchemaType<typeof workoutPlanSchema>;
export const WorkoutPlanModel = model('WorkoutPlan', workoutPlanSchema);
