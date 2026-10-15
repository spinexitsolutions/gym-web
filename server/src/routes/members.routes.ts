import { Router } from 'express';
import { z } from 'zod';
import { hasPermission, requireAuth, requirePermission, requireRole } from '../middleware/auth';
import { imageUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  AttendanceModel,
  BookingModel,
  LoyaltyTransactionModel,
  MediaAssetModel,
  MemberProfileModel,
  MembershipModel,
  NotificationModel,
  PaymentModel,
  ProgressEntryModel,
  ProgressPhotoModel,
  ReviewModel,
  UserModel,
  WorkoutLogModel,
  WorkoutPlanModel,
  publicUser,
} from '../models';
import { assertCanAccessMember } from '../services/access.service';
import { audit } from '../services/audit.service';
import { hashPassword } from '../services/auth.service';
import { processImageUpload } from '../services/media.service';
import { ensureMemberProfile } from '../services/member.service';
import { getActiveMembership, membershipView } from '../services/membership.service';
import { paymentView } from '../services/payment.service';
import { deleteFile } from '../services/storage';
import { revokeAllSessions } from '../services/token.service';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';
import { sendCsv } from '../utils/csv';
import { addDays } from '../utils/dates';
import { shallowDiff } from '../utils/diff';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';
import { emailSchema, passwordSchema } from '../validators/auth.validators';

const r = Router();
r.use(requireAuth);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

/* ------------------------------ Member: self ------------------------------ */

const profileUpdate = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/).optional(),
  avatarUrl: z.string().trim().max(1000).regex(/^(\/uploads\/|https:\/\/)/).or(z.literal('')).optional(),
  notificationPrefs: z.object({ email: z.boolean(), whatsapp: z.boolean(), marketing: z.boolean() }).partial().optional(),
  profile: z
    .object({
      dateOfBirth: z.coerce.date().nullable().optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not']).optional(),
      heightCm: z.number().min(50).max(260).nullable().optional(),
      address: z.string().trim().max(300).optional(),
      emergencyContact: z.object({ name: z.string().trim().max(100), phone: z.string().trim().max(30) }).partial().optional(),
      fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      healthNotes: z.string().trim().max(2000).optional(),
      progressPhotosSharedWithTrainer: z.boolean().optional(),
    })
    .optional(),
});

async function memberProfileView(userId: string) {
  const profile = await ensureMemberProfile(userId);
  const p = await MemberProfileModel.findById(profile._id).populate('assignedTrainer', 'name avatarUrl').lean();
  return p;
}

r.get(
  '/me',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    ok(res, { user: publicUser(user!), profile: await memberProfileView(req.user!.id) });
  }),
);

r.patch(
  '/me',
  requireRole('member'),
  validate({ body: profileUpdate }),
  asyncHandler(async (req, res) => {
    const { profile, notificationPrefs, ...userFields } = req.body as z.infer<typeof profileUpdate>;
    const set: Record<string, unknown> = { ...userFields };
    if (notificationPrefs) for (const [k, v] of Object.entries(notificationPrefs)) set[`notificationPrefs.${k}`] = v;
    const user = await UserModel.findByIdAndUpdate(req.user!.id, { $set: set }, { new: true });
    if (profile) {
      await ensureMemberProfile(req.user!.id);
      const pset: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(profile)) {
        if (k === 'emergencyContact' && v) for (const [ek, ev] of Object.entries(v)) pset[`emergencyContact.${ek}`] = ev;
        else pset[k] = v;
      }
      await MemberProfileModel.updateOne({ user: req.user!.id }, { $set: pset });
    }
    ok(res, { user: publicUser(user!), profile: await memberProfileView(req.user!.id) });
  }),
);

r.post(
  '/me/avatar',
  requireRole('member', 'trainer', 'admin'),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose an image');
    const asset = await processImageUpload(req.file, { visibility: 'public', folder: 'avatars', uploadedBy: req.user!.id, owner: req.user!.id });
    const url = asset.variants?.find((v) => v.width === 480)?.url ?? asset.url;
    await UserModel.updateOne({ _id: req.user!.id }, { $set: { avatarUrl: url } });
    ok(res, { avatarUrl: url });
  }),
);

/** All dashboard data in one call. */
r.get(
  '/me/dashboard',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const uid = req.user!.id;
    const now = new Date();
    const [active, upcomingMembership, nextBookings, plan, recentAttendance, attendanceCount30, progress, unread, profile, lastPayment] = await Promise.all([
      getActiveMembership(uid),
      MembershipModel.findOne({ user: uid, status: 'upcoming' }).sort({ startDate: 1 }).lean(),
      BookingModel.find({ user: uid, active: true, endsAt: { $gte: now } }).populate('gymClass', 'title location').populate('trainer', 'name').sort({ startsAt: 1 }).limit(5).lean(),
      WorkoutPlanModel.findOne({ member: uid, status: 'active', isTemplate: false }).populate('trainer', 'name').sort({ updatedAt: -1 }).lean(),
      AttendanceModel.find({ user: uid }).sort({ checkInAt: -1 }).limit(5).lean(),
      AttendanceModel.countDocuments({ user: uid, checkInAt: { $gte: addDays(now, -30) } }),
      ProgressEntryModel.find({ member: uid }).sort({ date: -1 }).limit(12).lean(),
      NotificationModel.countDocuments({ user: uid, readAt: null }),
      memberProfileView(uid),
      PaymentModel.findOne({ user: uid, status: 'captured' }).sort({ capturedAt: -1 }).lean(),
    ]);
    ok(res, {
      membership: active ? membershipView(active.toObject()) : null,
      upcomingMembership: upcomingMembership ? membershipView(upcomingMembership) : null,
      nextBookings,
      workoutPlan: plan,
      recentAttendance,
      attendanceLast30Days: attendanceCount30,
      progress: progress.reverse(),
      unreadNotifications: unread,
      loyaltyPoints: profile?.loyaltyPoints ?? 0,
      referralCode: profile?.referralCode ?? null,
      goals: profile?.goals ?? [],
      lastPayment: lastPayment ? paymentView(lastPayment) : null,
    });
  }),
);

/* Goals */
const goalBody = z.object({
  title: z.string().trim().min(2).max(120),
  metric: z.enum(['weight', 'bodyFat', 'attendance', 'custom']).default('custom'),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().trim().max(12).default(''),
  deadline: z.coerce.date().optional().nullable(),
  status: z.enum(['active', 'achieved', 'abandoned']).default('active'),
});
r.post(
  '/me/goals',
  requireRole('member'),
  validate({ body: goalBody }),
  asyncHandler(async (req, res) => {
    await ensureMemberProfile(req.user!.id);
    const p = await MemberProfileModel.findOneAndUpdate({ user: req.user!.id, 'goals.19': { $exists: false } }, { $push: { goals: req.body } }, { new: true });
    if (!p) throw AppError.conflict('You can track up to 20 goals');
    created(res, p.goals);
  }),
);
r.put(
  '/me/goals/:goalId',
  requireRole('member'),
  validate({ body: goalBody }),
  asyncHandler(async (req, res) => {
    const set = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [`goals.$.${k}`, v]));
    const p = await MemberProfileModel.findOneAndUpdate({ user: req.user!.id, 'goals._id': req.params.goalId }, { $set: set }, { new: true });
    if (!p) throw AppError.notFound('Goal');
    ok(res, p.goals);
  }),
);
r.delete(
  '/me/goals/:goalId',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const p = await MemberProfileModel.findOneAndUpdate({ user: req.user!.id }, { $pull: { goals: { _id: req.params.goalId } } }, { new: true });
    ok(res, p?.goals ?? []);
  }),
);

/* Progress entries: the member, or their assigned trainer, or staff. */
const progressBody = z.object({
  date: z.coerce.date(),
  weightKg: z.number().min(20).max(400).optional().nullable(),
  bodyFatPct: z.number().min(2).max(70).optional().nullable(),
  measurements: z.object({ chestCm: z.number().min(0).max(300), waistCm: z.number().min(0).max(300), hipsCm: z.number().min(0).max(300), armCm: z.number().min(0).max(150), thighCm: z.number().min(0).max(200) }).partial().default({}),
  notes: z.string().trim().max(1000).default(''),
});

const memberParam = (req: { params: { memberId?: string }; user?: { id: string } }) => (req.params.memberId === 'me' ? req.user!.id : req.params.memberId!);

r.get(
  '/:memberId/progress',
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    ok(res, await ProgressEntryModel.find({ member: memberId }).sort({ date: 1 }).limit(500).lean());
  }),
);
r.post(
  '/:memberId/progress',
  validate({ body: progressBody }),
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    if (req.user!.id !== memberId && req.user!.role === 'member') throw AppError.forbidden();
    created(res, await ProgressEntryModel.create({ ...req.body, member: memberId, recordedBy: req.user!.id }));
  }),
);
r.delete(
  '/:memberId/progress/:entryId',
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    const e = await ProgressEntryModel.findOneAndDelete({ _id: req.params.entryId, member: memberId, ...(req.user!.id === memberId || hasPermission(req.user, 'members:write') ? {} : { recordedBy: req.user!.id }) });
    if (!e) throw AppError.notFound('Entry');
    ok(res, { deleted: true });
  }),
);

/* Private progress photos */
r.get(
  '/:memberId/photos',
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    if (req.user!.role === 'trainer' && req.user!.id !== memberId) {
      const shared = await MemberProfileModel.exists({ user: memberId, progressPhotosSharedWithTrainer: true });
      if (!shared) return ok(res, []);
    }
    const photos = await ProgressPhotoModel.find({ member: memberId }).sort({ takenAt: -1 }).lean();
    ok(res, photos.map((p) => ({ id: String(p._id), takenAt: p.takenAt, pose: p.pose, note: p.note, url: `/api/v1/media/private/${p.asset}` })));
  }),
);
r.post(
  '/me/photos',
  requireRole('member'),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose a photo');
    const meta = z.object({ takenAt: z.coerce.date().default(new Date()), pose: z.enum(['front', 'side', 'back', 'other']).default('front'), note: z.string().trim().max(300).default('') }).parse(req.body);
    const count = await ProgressPhotoModel.countDocuments({ member: req.user!.id });
    if (count >= 200) throw AppError.conflict('Photo limit reached. Delete older photos first.');
    const asset = await processImageUpload(req.file, { visibility: 'private', folder: 'progress', uploadedBy: req.user!.id, owner: req.user!.id });
    const photo = await ProgressPhotoModel.create({ member: req.user!.id, asset: asset._id, ...meta });
    created(res, { id: String(photo._id), takenAt: photo.takenAt, pose: photo.pose, note: photo.note, url: `/api/v1/media/private/${asset._id}` });
  }),
);
r.delete(
  '/me/photos/:id',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const photo = await ProgressPhotoModel.findOneAndDelete({ _id: req.params.id, member: req.user!.id });
    if (!photo) throw AppError.notFound('Photo');
    const asset = await MediaAssetModel.findByIdAndDelete(photo.asset);
    if (asset) await deleteFile(asset.storage as 'local' | 'cloudinary', asset.key, asset.mime);
    ok(res, { deleted: true });
  }),
);

/* Workout logs (training history) */
const logBody = z.object({
  plan: objectId.optional().nullable(),
  dayName: z.string().trim().max(60).default(''),
  performedAt: z.coerce.date(),
  durationMin: z.number().int().min(0).max(600).optional(),
  entries: z.array(z.object({ name: z.string().trim().min(1).max(100), sets: z.array(z.object({ reps: z.number().int().min(0).max(500), weightKg: z.number().min(0).max(1000).default(0) })).max(20) })).max(40).default([]),
  notes: z.string().trim().max(1000).default(''),
});
r.get(
  '/:memberId/workout-logs',
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    ok(res, await WorkoutLogModel.find({ member: memberId }).sort({ performedAt: -1 }).limit(100).lean());
  }),
);
r.post(
  '/:memberId/workout-logs',
  validate({ body: logBody }),
  asyncHandler(async (req, res) => {
    const memberId = memberParam(req);
    await assertCanAccessMember(req.user!, memberId);
    if (req.body.plan) {
      const plan = await WorkoutPlanModel.exists({ _id: req.body.plan, member: memberId });
      if (!plan) throw AppError.validation('Workout plan not found for this member');
    }
    created(res, await WorkoutLogModel.create({ ...req.body, plan: req.body.plan || undefined, member: memberId, loggedBy: req.user!.id }));
  }),
);

r.get(
  '/me/loyalty',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const [profile, history, referrals] = await Promise.all([
      ensureMemberProfile(req.user!.id),
      LoyaltyTransactionModel.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean(),
      MemberProfileModel.countDocuments({ referredBy: req.user!.id }),
    ]);
    ok(res, { points: profile.loyaltyPoints, referralCode: profile.referralCode, referrals, history });
  }),
);

r.post(
  '/me/reviews',
  requireRole('member'),
  validate({ body: z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).default(''), body: z.string().trim().min(10).max(2000) }) }),
  asyncHandler(async (req, res) => {
    const has = await MembershipModel.exists({ user: req.user!.id });
    if (!has) throw AppError.forbidden('Reviews are open to members with a membership');
    const recent = await ReviewModel.exists({ user: req.user!.id, createdAt: { $gte: addDays(new Date(), -30) } });
    if (recent) throw AppError.conflict('You can submit one review every 30 days');
    created(res, await ReviewModel.create({ ...req.body, user: req.user!.id, displayName: req.user!.name.split(' ')[0] }));
  }),
);

/* ----------------------------- Staff: members ----------------------------- */

const memberList = listQuery.extend({
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  membership: z.enum(['active', 'expired', 'none', 'expiring']).optional(),
  trainer: objectId.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

r.get(
  '/',
  requireRole('admin', 'trainer'),
  validate({ query: memberList }),
  asyncHandler(async (req, res) => {
    const { page, limit, q, status, membership, trainer, format } = res.locals.query as z.infer<typeof memberList>;
    const filter: Record<string, unknown> = { role: 'member' };
    if (status) filter.status = status;
    if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { email: { $regex: escapeRegex(q), $options: 'i' } }, { phone: { $regex: escapeRegex(q), $options: 'i' } }];
    const canSeeAll = hasPermission(req.user, 'members:read');
    const restrictTo: unknown[] | null = canSeeAll ? null : (await MemberProfileModel.find({ assignedTrainer: req.user!.id }).select('user').lean()).map((p) => p.user);
    if (trainer && canSeeAll) {
      const ids = (await MemberProfileModel.find({ assignedTrainer: trainer }).select('user').lean()).map((p) => p.user);
      filter._id = { $in: ids };
    }
    if (restrictTo) filter._id = { $in: restrictTo };
    const now = new Date();
    if (membership) {
      const activeIds = await MembershipModel.distinct('user', { status: 'active', endDate: { $gt: now } });
      const key = '_id';
      const existing = filter[key] as { $in?: unknown[] } | undefined;
      const intersect = (ids: unknown[]) => (existing?.$in ? existing.$in.filter((x) => ids.some((y) => String(y) === String(x))) : ids);
      if (membership === 'active') filter[key] = { $in: intersect(activeIds) };
      if (membership === 'expiring') filter[key] = { $in: intersect(await MembershipModel.distinct('user', { status: 'active', endDate: { $gt: now, $lte: addDays(now, 14) } })) };
      if (membership === 'expired') {
        const expiredIds = await MembershipModel.distinct('user', { status: 'expired' });
        filter[key] = { $in: intersect(expiredIds.filter((id) => !activeIds.some((a) => String(a) === String(id)))) };
      }
      if (membership === 'none') {
        const any = await MembershipModel.distinct('user');
        filter[key] = existing?.$in ? { $in: existing.$in.filter((x) => !any.some((y) => String(y) === String(x))) } : { $nin: any };
      }
    }
    if (format === 'csv') {
      if (!hasPermission(req.user, 'reports:read') && !hasPermission(req.user, 'members:read')) throw AppError.forbidden();
      const users = await UserModel.find(filter).sort({ createdAt: -1 }).limit(10000).lean();
      const ms = await MembershipModel.find({ user: { $in: users.map((u) => u._id) }, status: { $in: ['active', 'upcoming'] } }).lean();
      await audit(req, { action: 'members.export', entity: 'User', summary: `Exported ${users.length} members` });
      return sendCsv(res, 'members.csv', ['name', 'email', 'phone', 'status', 'joined', 'membership', 'membership_end'], users.map((u) => {
        const m = ms.find((x) => String(x.user) === String(u._id));
        return [u.name, u.email, u.phone, u.status, u.createdAt, m?.planSnapshot?.name ?? '', m?.endDate ?? ''];
      }));
    }
    const [users, total] = await Promise.all([UserModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), UserModel.countDocuments(filter)]);
    const ids = users.map((u) => u._id);
    const [memberships, profiles] = await Promise.all([
      MembershipModel.find({ user: { $in: ids }, status: { $in: ['active', 'upcoming', 'expired'] } }).sort({ endDate: -1 }).lean(),
      MemberProfileModel.find({ user: { $in: ids } }).populate('assignedTrainer', 'name').lean(),
    ]);
    ok(
      res,
      users.map((u) => {
        const m = memberships.find((x) => String(x.user) === String(u._id));
        const p = profiles.find((x) => String(x.user) === String(u._id));
        return { ...publicUser(u), membership: m ? membershipView(m) : null, assignedTrainer: p?.assignedTrainer ?? null };
      }),
      pageMeta(page, limit, total),
    );
  }),
);

r.get(
  '/:id',
  requireRole('admin', 'trainer'),
  asyncHandler(async (req, res) => {
    await assertCanAccessMember(req.user!, req.params.id);
    const user = await UserModel.findOne({ _id: req.params.id, role: 'member' });
    if (!user) throw AppError.notFound('Member');
    const canFinance = hasPermission(req.user, 'payments:read');
    const [profile, memberships, payments, attendance, bookings, plans] = await Promise.all([
      MemberProfileModel.findOne({ user: user._id }).populate('assignedTrainer', 'name email').lean(),
      MembershipModel.find({ user: user._id }).sort({ startDate: -1 }).lean(),
      canFinance ? PaymentModel.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean() : Promise.resolve([]),
      AttendanceModel.find({ user: user._id }).sort({ checkInAt: -1 }).limit(30).lean(),
      BookingModel.find({ user: user._id }).populate('gymClass', 'title').sort({ startsAt: -1 }).limit(30).lean(),
      WorkoutPlanModel.find({ member: user._id }).select('title status trainer updatedAt').populate('trainer', 'name').sort({ updatedAt: -1 }).lean(),
    ]);
    ok(res, {
      user: publicUser(user),
      profile,
      memberships: memberships.map((m) => membershipView(m)),
      payments: canFinance ? payments.map(paymentView) : null,
      attendance,
      bookings,
      workoutPlans: plans,
    });
  }),
);

r.post(
  '/',
  requirePermission('members:write'),
  validate({ body: z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, phone: z.string().trim().max(30).default(''), password: passwordSchema.optional() }) }),
  asyncHandler(async (req, res) => {
    if (await UserModel.exists({ email: req.body.email })) throw AppError.conflict('An account with this email already exists');
    // Without a password the member sets one via "Forgot password".
    const user = await UserModel.create({ name: req.body.name, email: req.body.email, phone: req.body.phone || undefined, passwordHash: await hashPassword(req.body.password ?? randomToken(24)), role: 'member', qrToken: randomToken(18), createdBy: req.user!.id });
    await ensureMemberProfile(user._id);
    await audit(req, { action: 'member.create', entity: 'User', entityId: user._id, summary: `Created member ${user.email}` });
    created(res, publicUser(user));
  }),
);

r.patch(
  '/:id',
  requirePermission('members:write'),
  validate({ body: z.object({ name: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().max(30).optional(), email: emailSchema.optional() }) }),
  asyncHandler(async (req, res) => {
    const before = await UserModel.findOne({ _id: req.params.id, role: 'member' }).lean<Record<string, unknown>>();
    if (!before) throw AppError.notFound('Member');
    const user = await UserModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    await audit(req, { action: 'member.update', entity: 'User', entityId: req.params.id, changes: shallowDiff(before, req.body) });
    ok(res, publicUser(user!));
  }),
);

r.post(
  '/:id/status',
  requirePermission('members:write'),
  validate({ body: z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().min(3).max(300) }) }),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOneAndUpdate({ _id: req.params.id, role: 'member' }, { $set: { status: req.body.status } }, { new: true });
    if (!user) throw AppError.notFound('Member');
    if (req.body.status === 'suspended') await revokeAllSessions(user._id);
    await audit(req, { action: `member.${req.body.status === 'suspended' ? 'suspend' : 'reactivate'}`, entity: 'User', entityId: user._id, summary: `${user.email}: ${req.body.reason}` });
    ok(res, publicUser(user));
  }),
);

r.post(
  '/:id/assign-trainer',
  requirePermission('members:write'),
  validate({ body: z.object({ trainerId: objectId.nullable() }) }),
  asyncHandler(async (req, res) => {
    const member = await UserModel.exists({ _id: req.params.id, role: 'member' });
    if (!member) throw AppError.notFound('Member');
    if (req.body.trainerId && !(await UserModel.exists({ _id: req.body.trainerId, role: 'trainer', status: 'active' }))) throw AppError.validation('Trainer not found');
    await ensureMemberProfile(req.params.id);
    await MemberProfileModel.updateOne({ user: req.params.id }, req.body.trainerId ? { $set: { assignedTrainer: req.body.trainerId } } : { $unset: { assignedTrainer: 1 } });
    await audit(req, { action: 'member.assign_trainer', entity: 'User', entityId: req.params.id, summary: req.body.trainerId ? `Assigned trainer ${req.body.trainerId}` : 'Removed trainer' });
    ok(res, { assigned: req.body.trainerId });
  }),
);

export default r;
