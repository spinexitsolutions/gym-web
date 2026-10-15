import { Schema, model, type InferSchemaType } from 'mongoose';

const workoutLogSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'WorkoutPlan' },
    dayName: { type: String, maxlength: 60 },
    performedAt: { type: Date, required: true },
    durationMin: { type: Number, min: 0, max: 600 },
    entries: [
      {
        _id: false,
        name: { type: String, required: true, maxlength: 100 },
        sets: [{ _id: false, reps: { type: Number, min: 0, max: 500 }, weightKg: { type: Number, min: 0, max: 1000 } }],
      },
    ],
    notes: { type: String, maxlength: 1000 },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
workoutLogSchema.index({ member: 1, performedAt: -1 });

export type WorkoutLog = InferSchemaType<typeof workoutLogSchema>;
export const WorkoutLogModel = model('WorkoutLog', workoutLogSchema);
