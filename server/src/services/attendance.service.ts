import type { AuthUser } from '../middleware/auth';
import { hasPermission } from '../middleware/auth';
import { AttendanceModel, MemberProfileModel, UserModel } from '../models';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';
import { dayKey } from '../utils/dates';
import { awardCheckInPoints } from './booking.service';
import { getActiveMembership } from './membership.service';
import { getSiteSettings } from './settings.service';

/** QR payload format: `APEX:<qrToken>`. Tokens can be rotated by the member at any time. */
export const qrPayload = (token: string) => `APEX:${token}`;

export async function getOrCreateQrToken(userId: string) {
  const user = await UserModel.findById(userId).select('+qrToken');
  if (!user) throw AppError.unauthorized();
  if (!user.qrToken) {
    user.qrToken = randomToken(18);
    await user.save();
  }
  return user.qrToken;
}

export async function rotateQrToken(userId: string) {
  const token = randomToken(18);
  await UserModel.updateOne({ _id: userId }, { $set: { qrToken: token } });
  return token;
}

/**
 * Checks a member in by QR code or member id. Requires an active membership and allows one
 * general check-in per member per day. Trainers may only check in their assigned members.
 */
export async function checkIn(viewer: AuthUser, input: { qr?: string; memberId?: string }) {
  let user;
  if (input.qr) {
    const token = input.qr.startsWith('APEX:') ? input.qr.slice(5) : input.qr;
    user = await UserModel.findOne({ qrToken: token, role: 'member' }).select('name email status avatarUrl');
  } else if (input.memberId) {
    user = await UserModel.findOne({ _id: input.memberId, role: 'member' }).select('name email status avatarUrl');
  }
  if (!user) throw AppError.notFound('Member');
  if (!hasPermission(viewer, 'attendance:write')) {
    const assigned = viewer.role === 'trainer' && (await MemberProfileModel.exists({ user: user._id, assignedTrainer: viewer.id }));
    if (!assigned) throw AppError.forbidden('You can only check in members assigned to you');
  }
  if (user.status !== 'active') throw AppError.conflict('This account is suspended');
  const membership = await getActiveMembership(user._id);
  if (!membership) throw new AppError(403, 'MEMBERSHIP_REQUIRED', `${user.name} does not have an active membership`);
  const settings = await getSiteSettings();
  const day = dayKey(new Date(), settings.business.timezone);
  try {
    const record = await AttendanceModel.create({ user: user._id, day, checkInAt: new Date(), method: input.qr ? 'qr' : 'manual', gymClass: null, recordedBy: viewer.id });
    await awardCheckInPoints(user._id, day);
    return { record, member: { id: String(user._id), name: user.name, avatarUrl: user.avatarUrl ?? '' }, membership: { planName: membership.planSnapshot?.name, endDate: membership.endDate } };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw AppError.conflict(`${user.name} has already checked in today`);
    throw err;
  }
}

export async function checkOut(viewer: AuthUser, attendanceId: string) {
  if (!hasPermission(viewer, 'attendance:write') && viewer.role !== 'trainer') throw AppError.forbidden();
  const rec = await AttendanceModel.findOneAndUpdate({ _id: attendanceId, checkOutAt: null }, { $set: { checkOutAt: new Date() } }, { new: true });
  if (!rec) throw AppError.notFound('Open attendance record');
  return rec;
}
