import type { ClientSession, Types } from 'mongoose';
import { MemberProfileModel } from '../models';
import { shortCode } from '../utils/crypto';

/** Creates the member profile (with a unique referral code) if missing. */
export async function ensureMemberProfile(userId: string | Types.ObjectId, extra: { referredBy?: Types.ObjectId | string } = {}, session?: ClientSession) {
  const existing = await MemberProfileModel.findOne({ user: userId }).session(session ?? null);
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    try {
      const [doc] = await MemberProfileModel.create([{ user: userId, referralCode: shortCode(8), referredBy: extra.referredBy }], { session });
      return doc;
    } catch (err) {
      if ((err as { code?: number; keyPattern?: Record<string, number> }).code === 11000 && (err as { keyPattern?: Record<string, number> }).keyPattern?.referralCode) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate referral code');
}
