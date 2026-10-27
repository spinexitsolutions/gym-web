import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['gym', 'trainer', 'class'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, refPath: 'targetModel' },
    targetModel: { type: String, enum: ['Trainer', 'ClassSchedule'] },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

reviewSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });
reviewSchema.index({ targetType: 1, target: 1, status: 1 });

export default mongoose.model('Review', reviewSchema);
