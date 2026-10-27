import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { imageSchema } from './_shared.js';

export const ROLES = ['owner', 'admin', 'staff', 'trainer', 'member'];
export const STAFF_ROLES = ['owner', 'admin', 'staff'];
const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'member', index: true },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
    avatar: imageSchema,

    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: Date,

    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: Date,

    deletionRequestedAt: Date,
    deletionReason: { type: String, maxlength: 500 },
    suspendedReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    status: this.status,
    avatar: this.avatar?.url ? this.avatar : null,
    emailVerified: this.emailVerified,
    deletionRequestedAt: this.deletionRequestedAt,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
