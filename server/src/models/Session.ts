import { Schema, model, type InferSchemaType } from 'mongoose';

/** Refresh-token session. Only a SHA-256 hash of the token is stored. Tokens rotate on every refresh. */
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    /** All rotations of one login share a family; reuse of a rotated token revokes the family. */
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    rotatedAt: Date,
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const SessionModel = model('Session', sessionSchema);
