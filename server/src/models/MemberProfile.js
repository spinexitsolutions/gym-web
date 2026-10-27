import mongoose from 'mongoose';

const memberProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      pincode: { type: String, trim: true, maxlength: 12 },
    },
    heightCm: { type: Number, min: 50, max: 260 },
    fitnessGoals: [{ type: String, trim: true, maxlength: 80 }],
    fitnessLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 80 },
      phone: { type: String, trim: true, maxlength: 20 },
      relation: { type: String, trim: true, maxlength: 40 },
    },
    medicalNotes: { type: String, trim: true, maxlength: 1000 },
    referralCode: { type: String, unique: true, sparse: true, uppercase: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export default mongoose.model('MemberProfile', memberProfileSchema);
