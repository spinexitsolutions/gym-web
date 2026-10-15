import { Schema, model, type InferSchemaType } from 'mongoose';

const exerciseSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    category: { type: String, enum: ['strength', 'cardio', 'mobility', 'conditioning', 'core', 'olympic', 'other'], default: 'strength', index: true },
    muscleGroups: { type: [String], default: [] },
    equipment: { type: [String], default: [] },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    instructions: { type: String, maxlength: 4000 },
    mediaUrl: { type: String, maxlength: 1000 },
    videoUrl: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
exerciseSchema.index({ name: 'text' });

export type Exercise = InferSchemaType<typeof exerciseSchema>;
export const ExerciseModel = model('Exercise', exerciseSchema);
