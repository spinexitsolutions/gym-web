import mongoose from 'mongoose';

const progressEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    weightKg: { type: Number, min: 20, max: 400 },
    bodyFatPct: { type: Number, min: 2, max: 70 },
    measurements: {
      chestCm: { type: Number, min: 30, max: 250 },
      waistCm: { type: Number, min: 30, max: 250 },
      hipsCm: { type: Number, min: 30, max: 250 },
      armCm: { type: Number, min: 10, max: 100 },
      thighCm: { type: Number, min: 20, max: 150 },
    },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

progressEntrySchema.index({ user: 1, date: -1 });

export default mongoose.model('ProgressEntry', progressEntrySchema);
