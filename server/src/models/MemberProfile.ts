import { Schema, model, type InferSchemaType } from 'mongoose';

const goalSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    metric: { type: String, enum: ['weight', 'bodyFat', 'attendance', 'custom'], default: 'custom' },
    startValue: Number,
    targetValue: Number,
    unit: { type: String, maxlength: 12 },
    deadline: Date,
    status: { type: String, enum: ['active', 'achieved', 'abandoned'], default: 'active' },
  },
  { timestamps: true },
);

const memberProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not'], default: 'prefer_not' },
    heightCm: { type: Number, min: 50, max: 260 },
    address: { type: String, maxlength: 300 },
    emergencyContact: { name: { type: String, maxlength: 100 }, phone: { type: String, maxlength: 30 } },
    fitnessLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    /** Health notes shared with the assigned trainer and admins only. */
    healthNotes: { type: String, maxlength: 2000 },
    goals: { type: [goalSchema], default: [] },
    assignedTrainer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    progressPhotosSharedWithTrainer: { type: Boolean, default: false },
    trialUsed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type MemberProfile = InferSchemaType<typeof memberProfileSchema>;
export const MemberProfileModel = model('MemberProfile', memberProfileSchema);
