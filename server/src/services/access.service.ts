import type { Types } from 'mongoose';
import type { AuthUser } from '../middleware/auth';
import { hasPermission } from '../middleware/auth';
import { MemberProfileModel } from '../models';
import { AppError } from '../utils/AppError';

/**
 * Ownership rule for member data:
 *  - the member themself
 *  - admins, or staff with members:read
 *  - the trainer the member is assigned to
 */
export async function canAccessMember(viewer: AuthUser, memberId: string | Types.ObjectId): Promise<boolean> {
  if (viewer.id === String(memberId)) return true;
  if (hasPermission(viewer, 'members:read')) return true;
  if (viewer.role === 'trainer') {
    const profile = await MemberProfileModel.exists({ user: memberId, assignedTrainer: viewer.id });
    return Boolean(profile);
  }
  return false;
}

export async function assertCanAccessMember(viewer: AuthUser, memberId: string | Types.ObjectId) {
  if (!(await canAccessMember(viewer, memberId))) throw AppError.notFound('Member');
}

/** Returns the ids of members assigned to a trainer. */
export async function assignedMemberIds(trainerId: string) {
  const rows = await MemberProfileModel.find({ assignedTrainer: trainerId }).select('user').lean();
  return rows.map((r) => r.user);
}
