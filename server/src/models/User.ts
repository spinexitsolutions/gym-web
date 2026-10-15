import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ACCOUNT_STATUSES, PERMISSIONS, ROLES } from '@apex/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'member', index: true },
    permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] },
    status: { type: String, enum: ACCOUNT_STATUSES, default: 'active', index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    avatarUrl: { type: String, maxlength: 1000 },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: Date,
    /** Rotatable secret encoded in the member's attendance QR code. */
    qrToken: { type: String, unique: true, sparse: true, select: false },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ role: 1, createdAt: -1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

/** Fields safe to return to the account owner / admins. */
export function publicUser(u: UserDoc | (User & { _id: unknown })) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: u.permissions ?? [],
    status: u.status,
    phone: u.phone ?? '',
    avatarUrl: u.avatarUrl ?? '',
    emailVerified: u.emailVerified,
    notificationPrefs: u.notificationPrefs,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: (u as { createdAt?: Date }).createdAt ?? null,
  };
}
