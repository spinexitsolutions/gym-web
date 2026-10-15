import { Schema, model, type InferSchemaType } from 'mongoose';

const progressEntrySchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    weightKg: { type: Number, min: 20, max: 400 },
    bodyFatPct: { type: Number, min: 2, max: 70 },
    measurements: {
      chestCm: { type: Number, min: 0, max: 300 },
      waistCm: { type: Number, min: 0, max: 300 },
      hipsCm: { type: Number, min: 0, max: 300 },
      armCm: { type: Number, min: 0, max: 150 },
      thighCm: { type: Number, min: 0, max: 200 },
    },
    notes: { type: String, maxlength: 1000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
progressEntrySchema.index({ member: 1, date: -1 });

export type ProgressEntry = InferSchemaType<typeof progressEntrySchema>;
export const ProgressEntryModel = model('ProgressEntry', progressEntrySchema);
