import { z } from 'zod';
import {
  User, MemberProfile, Membership, Payment, Attendance, Booking, ProgressEntry, Session, Trainer,
} from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { revokeAllSessions } from '../services/token.service.js';
import { sendEmail, appUrl } from '../services/email.service.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/pagination.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { sendCsv } from '../utils/csv.js';
import { email, phone, objectId } from '../validators/common.js';

export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  membership: z.enum(['active', 'expired', 'none', 'expiring']).optional(),
  deletionRequested: z.enum(['true']).optional(),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt', 'membershipEnd', '-membershipEnd']).default('-createdAt'),
});

// Users + their latest membership in one aggregation (search, filter, sort and paginate server-side).
function membersPipeline({ q, status, membership, deletionRequested, sort }) {
  const now = new Date();
  const match = { role: 'member' };
  match.status = status || { $ne: 'deleted' };
  if (deletionRequested) match.deletionRequestedAt = { $ne: null };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    match.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'memberships', localField: '_id', foreignField: 'user', as: 'membership',
        pipeline: [{ $match: { status: { $in: ['active', 'expired', 'suspended', 'cancelled'] } } }, { $sort: { endDate: -1 } }, { $limit: 1 },
          { $lookup: { from: 'membershipplans', localField: 'plan', foreignField: '_id', as: 'plan', pipeline: [{ $project: { name: 1, tier: 1 } }] } },
          { $set: { plan: { $first: '$plan' } } }],
      },
    },
    { $set: { membership: { $first: '$membership' } } },
    { $set: { membershipState: { $switch: { branches: [
      { case: { $not: ['$membership'] }, then: 'none' },
      { case: { $and: [{ $eq: ['$membership.status', 'active'] }, { $gte: ['$membership.endDate', now] }] }, then: 'active' },
    ], default: 'expired' } } } },
  ];
  if (membership === 'expiring') {
    pipeline.push({ $match: { membershipState: 'active', 'membership.endDate': { $lte: new Date(Date.now() + 14 * 864e5) } } });
  } else if (membership) pipeline.push({ $match: { membershipState: membership } });
  const dir = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace('-', '') === 'membershipEnd' ? 'membership.endDate' : sort.replace('-', '');
  pipeline.push({ $sort: { [field]: dir, _id: 1 } });
  pipeline.push({ $project: { password: 0, emailVerifyTokenHash: 0, passwordResetTokenHash: 0, failedLoginAttempts: 0, lockUntil: 0 } });
  return pipeline;
}

export async function list(req, res) {
  const { page, limit } = req.query;
  const [result] = await User.aggregate([
    ...membersPipeline(req.query),
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  const total = result.total[0]?.n || 0;
  return ok(res, result.items, { meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

export async function exportCsv(req, res) {
  const rows = await User.aggregate(membersPipeline(req.query)).limit(20000);
  await audit(req, { action: 'members.export', entity: 'User', summary: `${rows.length} rows` });
  return sendCsv(res, `members-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    { label: 'Name', value: 'name' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' },
    { label: 'Account status', value: 'status' }, { label: 'Email verified', value: (r) => (r.emailVerified ? 'yes' : 'no') },
    { label: 'Membership', value: 'membershipState' }, { label: 'Plan', value: (r) => r.membership?.plan?.name },
    { label: 'Membership ends', value: (r) => r.membership?.endDate }, { label: 'Joined', value: 'createdAt' },
  ]);
}

export async function detail(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: 'member' });
  if (!user) throw ApiError.notFound('Member not found');
  const id = user._id;
  const [profile, memberships, payments, attendance, bookings, progress] = await Promise.all([
    MemberProfile.findOne({ user: id }).populate('assignedTrainer', 'name slug').populate('referredBy', 'name email').lean(),
    Membership.find({ user: id }).populate('plan', 'name tier').sort('-startDate').lean(),
    Payment.find({ user: id, status: { $ne: 'created' } }).populate('plan', 'name').sort('-createdAt').limit(50).lean(),
    Attendance.find({ member: id }).sort('-checkInAt').limit(30).lean(),
    Booking.find({ member: id }).populate('trainer', 'name').populate('classSchedule', 'title').sort('-startAt').limit(30).lean(),
    ProgressEntry.find({ user: id }).sort('-date').limit(20).lean(),
  ]);
  await audit(req, { action: 'member.view', entity: 'User', entityId: id });
  return ok(res, { user: user.toSafeJSON(), suspendedReason: user.suspendedReason, deletionReason: user.deletionReason, lastLoginAt: user.lastLoginAt, profile, memberships, payments, attendance, bookings, progress });
}

export const statusSchema = z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().min(3, 'A reason is required').max(300) });

export async function setStatus(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: 'member' });
  if (!user) throw ApiError.notFound('Member not found');
  user.status = req.body.status;
  user.suspendedReason = req.body.status === 'suspended' ? req.body.reason : undefined;
  await user.save();
  if (req.body.status === 'suspended') await revokeAllSessions(user._id);
  await audit(req, { action: `member.${req.body.status === 'suspended' ? 'suspend' : 'reactivate'}`, entity: 'User', entityId: user._id, summary: req.body.reason });
  return ok(res, user.toSafeJSON(), { message: req.body.status === 'suspended' ? 'Account suspended and signed out' : 'Account reactivated' });
}

export const staffProfileSchema = z.object({
  assignedTrainer: objectId.nullable().optional(),
  medicalNotes: z.string().trim().max(1000).optional(),
});

export async function updateProfile(req, res) {
  if (req.body.assignedTrainer && !(await Trainer.exists({ _id: req.body.assignedTrainer }))) throw ApiError.badRequest('Trainer not found');
  const profile = await MemberProfile.findOneAndUpdate({ user: req.params.id }, { $set: req.body }, { new: true, upsert: true, runValidators: true });
  await audit(req, { action: 'member.profile_update', entity: 'User', entityId: req.params.id, changes: req.body });
  return ok(res, profile, { message: 'Profile updated' });
}

export const createSchema = z.object({ name: z.string().trim().min(2).max(80), email, phone: phone.optional().or(z.literal('')) });

// Walk-in registration by staff: the member receives a link to set their own password.
export async function createMember(req, res) {
  if (await User.exists({ email: req.body.email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ ...req.body, phone: req.body.phone || undefined, password: `${randomToken(24)}Aa1`, role: 'member', emailVerified: false });
  await MemberProfile.create({ user: user._id, referralCode: `M${randomToken(4).toUpperCase()}` });
  const token = randomToken(32);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + 7 * 864e5);
  await user.save();
  await sendEmail({
    to: user.email, subject: 'Your membership account is ready', heading: `Welcome, ${user.name.split(' ')[0]}`,
    body: '<p>Our team has created your member account. Choose a password to sign in (link valid for 7 days).</p>',
    cta: { label: 'Set your password', href: appUrl(`/reset-password?token=${token}`) },
  });
  await audit(req, { action: 'member.create', entity: 'User', entityId: user._id, summary: user.email });
  return created(res, user.toSafeJSON(), 'Member created and invited by email');
}

export const deletionSchema = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(300).optional() });

// Approval anonymises personal data but keeps financial records (required for tax/accounting).
export async function processDeletion(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: 'member' });
  if (!user?.deletionRequestedAt) throw ApiError.badRequest('No pending deletion request');
  if (req.body.decision === 'reject') {
    user.deletionRequestedAt = undefined;
    await user.save();
    await audit(req, { action: 'member.deletion_reject', entity: 'User', entityId: user._id, summary: req.body.note });
    return ok(res, user.toSafeJSON(), { message: 'Deletion request rejected' });
  }
  user.set({ name: 'Deleted member', email: `deleted-${user._id}@invalid.local`, phone: undefined, avatar: undefined, status: 'deleted', deletionReason: undefined, password: randomToken(32) });
  await user.save();
  await MemberProfile.updateOne({ user: user._id }, { $unset: { dateOfBirth: 1, gender: 1, address: 1, heightCm: 1, fitnessGoals: 1, emergencyContact: 1, medicalNotes: 1 } });
  await ProgressEntry.deleteMany({ user: user._id });
  await Session.deleteMany({ user: user._id });
  await audit(req, { action: 'member.delete', entity: 'User', entityId: user._id, summary: 'Personal data anonymised' });
  return ok(res, null, { message: 'Member data anonymised' });
}
