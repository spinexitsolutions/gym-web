import { Schema, model, type InferSchemaType } from 'mongoose';

const gymClassSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 1000 },
    program: { type: Schema.Types.ObjectId, ref: 'Program' },
    trainer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    bookedCount: { type: Number, default: 0, min: 0 },
    waitlistCount: { type: Number, default: 0, min: 0 },
    location: { type: String, maxlength: 80 },
    level: { type: String, enum: ['all', 'beginner', 'intermediate', 'advanced'], default: 'all' },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
    seriesId: { type: String, index: true },
    cancelReason: { type: String, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
gymClassSchema.index({ startsAt: 1, status: 1 });

export type GymClass = InferSchemaType<typeof gymClassSchema>;
export const GymClassModel = model('GymClass', gymClassSchema);
