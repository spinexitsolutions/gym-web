import mongoose from 'mongoose';

// One row per issued refresh token. Rotation: each refresh revokes the old row and creates a new one in
// the same family; reuse of a revoked token revokes the whole family (stolen-token detection).
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);
