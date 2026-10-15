import { Router } from 'express';
import { z } from 'zod';
import { mediaUrl, slugSchema } from '@apex/shared';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BookingModel, GymClassModel, MemberProfileModel, TrainerNoteModel, TrainerProfileModel, UserModel, publicUser } from '../models';
import { assertCanAccessMember } from '../services/access.service';
import { audit } from '../services/audit.service';
import { hashPassword } from '../services/auth.service';
import { bumpContentVersion } from '../services/cms.service';
import { getActiveMembership, membershipView } from '../services/membership.service';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';
import { addDays } from '../utils/dates';
import { asyncHandler, created, ok } from '../utils/http';
import { emailSchema } from '../validators/auth.validators';

const r = Router();
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

const publicTrainer = (t: Record<string, unknown>) => ({
  id: String(t.user),
  slug: t.slug,
  displayName: t.displayName,
  title: t.title,
  bio: t.bio,
  specializations: t.specializations,
  certifications: t.certifications,
  experienceYears: t.experienceYears,
  photoUrl: t.photoUrl,
  instagram: t.instagram,
  ptSessionMinutes: t.ptSessionMinutes,
});

/* Public */
r.get(
  '/',
  validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(24) }) }),
  asyncHandler(async (_req, res) => {
    const { limit } = res.locals.query;
    const active = await UserModel.find({ role: 'trainer', status: 'active' }).select('_id').lean();
    const list = await TrainerProfileModel.find({ showOnWebsite: true, user: { $in: active.map((u) => u._id) } }).sort({ order: 1 }).limit(limit).lean();
    ok(res, list.map(publicTrainer));
  }),
);

r.get(
  '/profile/:slug',
  asyncHandler(async (req, res) => {
    const t = await TrainerProfileModel.findOne({ slug: req.params.slug, showOnWebsite: true }).lean();
    if (!t) throw AppError.notFound('Trainer');
    ok(res, publicTrainer(t));
  }),
);

r.use(requireAuth);

/* Trainer self-service */
const availability = z.array(z.object({ day: z.number().int().min(0).max(6), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine((a) => a.start < a.end, 'End must be after start')).max(21);

const selfProfile = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  title: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(3000).optional(),
  specializations: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  certifications: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  photoUrl: mediaUrl.optional(),
  instagram: z.string().trim().max(300).optional(),
  availability: availability.optional(),
  ptSessionMinutes: z.number().int().min(15).max(240).optional(),
});

r.get(
  '/me',
  requireRole('trainer'),
  asyncHandler(async (req, res) => {
    const profile = await TrainerProfileModel.findOne({ user: req.user!.id }).lean();
    if (!profile) throw AppError.notFound('Trainer profile');
    ok(res, profile);
  }),
);

r.patch(
  '/me',
  requireRole('trainer'),
  validate({ body: selfProfile }),
  asyncHandler(async (req, res) => {
    const p = await TrainerProfileModel.findOneAndUpdate({ user: req.user!.id }, { $set: req.body }, { new: true });
    if (!p) throw AppError.notFound('Trainer profile');
    bumpContentVersion();
    ok(res, p);
  }),
);

r.get(
  '/me/overview',
  requireRole('trainer'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const [assignedCount, upcomingClasses, upcomingSessions, followUps] = await Promise.all([
      MemberProfileModel.countDocuments({ assignedTrainer: req.user!.id }),
      GymClassModel.find({ trainer: req.user!.id, status: 'scheduled', startsAt: { $gte: now, $lt: addDays(now, 7) } }).sort({ startsAt: 1 }).limit(20).lean(),
      BookingModel.find({ trainer: req.user!.id, active: true, type: { $in: ['personal_training', 'trial'] }, startsAt: { $gte: now } }).populate('user', 'name').sort({ startsAt: 1 }).limit(20).lean(),
      TrainerNoteModel.find({ trainer: req.user!.id, done: false, followUpAt: { $ne: null, $lte: addDays(now, 7) } }).populate('member', 'name').sort({ followUpAt: 1 }).limit(20).lean(),
    ]);
    ok(res, { assignedCount, upcomingClasses, upcomingSessions, followUps });
  }),
);

r.get(
  '/me/members',
  requireRole('trainer'),
  asyncHandler(async (req, res) => {
    const profiles = await MemberProfileModel.find({ assignedTrainer: req.user!.id }).populate('user', 'name email phone avatarUrl status').lean();
    const out = await Promise.all(
      profiles.map(async (p) => {
        const m = await getActiveMembership(String((p.user as unknown as { _id: unknown })._id));
        return { user: p.user, fitnessLevel: p.fitnessLevel, goals: p.goals, healthNotes: p.healthNotes, membership: m ? membershipView(m.toObject()) : null };
      }),
    );
    ok(res, out);
  }),
);

r.get(
  '/me/schedule',
  requireRole('trainer'),
  validate({ query: z.object({ from: z.coerce.date().optional(), days: z.coerce.number().int().min(1).max(31).default(14) }) }),
  asyncHandler(async (req, res) => {
    const { from, days } = res.locals.query;
    const start = from ?? addDays(new Date(), -1);
    const end = addDays(start, days);
    const [classes, sessions] = await Promise.all([
      GymClassModel.find({ trainer: req.user!.id, startsAt: { $gte: start, $lt: end } }).sort({ startsAt: 1 }).lean(),
      BookingModel.find({ trainer: req.user!.id, type: { $in: ['personal_training', 'trial'] }, startsAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } }).populate('user', 'name email phone').sort({ startsAt: 1 }).lean(),
    ]);
    ok(res, { classes, sessions });
  }),
);

/* Trainer notes & follow-up reminders (only for assigned members). */
r.get(
  '/me/notes',
  requireRole('trainer'),
  validate({ query: z.object({ member: objectId.optional(), done: z.enum(['true', 'false']).optional() }) }),
  asyncHandler(async (req, res) => {
    const { member, done } = res.locals.query;
    const filter: Record<string, unknown> = { trainer: req.user!.id };
    if (member) filter.member = member;
    if (done) filter.done = done === 'true';
    ok(res, await TrainerNoteModel.find(filter).populate('member', 'name').sort({ createdAt: -1 }).limit(200).lean());
  }),
);
r.post(
  '/me/notes',
  requireRole('trainer'),
  validate({ body: z.object({ member: objectId, body: z.string().trim().min(1).max(2000), followUpAt: z.coerce.date().optional().nullable() }) }),
  asyncHandler(async (req, res) => {
    await assertCanAccessMember(req.user!, req.body.member);
    created(res, await TrainerNoteModel.create({ ...req.body, trainer: req.user!.id }));
  }),
);
r.patch(
  '/me/notes/:id',
  requireRole('trainer'),
  validate({ body: z.object({ body: z.string().trim().min(1).max(2000).optional(), followUpAt: z.coerce.date().optional().nullable(), done: z.boolean().optional() }) }),
  asyncHandler(async (req, res) => {
    const n = await TrainerNoteModel.findOneAndUpdate({ _id: req.params.id, trainer: req.user!.id }, { $set: req.body }, { new: true });
    if (!n) throw AppError.notFound('Note');
    ok(res, n);
  }),
);
r.delete(
  '/me/notes/:id',
  requireRole('trainer'),
  asyncHandler(async (req, res) => {
    const n = await TrainerNoteModel.findOneAndDelete({ _id: req.params.id, trainer: req.user!.id });
    if (!n) throw AppError.notFound('Note');
    ok(res, { deleted: true });
  }),
);

/* Admin trainer management */
const admin = Router();
admin.use(requirePermission('trainers:write'));

const trainerBody = selfProfile.extend({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: z.string().trim().max(30).default(''),
  slug: slugSchema,
  displayName: z.string().trim().min(2).max(100),
  experienceYears: z.number().int().min(0).max(70).default(0),
  showOnWebsite: z.boolean().default(true),
  order: z.number().int().min(0).max(1000).default(50),
  maxClients: z.number().int().min(0).max(500).default(30),
});

admin.get(
  '/admin/all',
  asyncHandler(async (_req, res) => {
    const profiles = await TrainerProfileModel.find().populate('user', 'name email phone status avatarUrl permissions').sort({ order: 1 }).lean();
    const counts = await MemberProfileModel.aggregate<{ _id: unknown; n: number }>([{ $match: { assignedTrainer: { $ne: null } } }, { $group: { _id: '$assignedTrainer', n: { $sum: 1 } } }]);
    ok(res, profiles.map((p) => ({ ...p, assignedMembers: counts.find((c) => String(c._id) === String((p.user as unknown as { _id: unknown })._id))?.n ?? 0 })));
  }),
);

admin.post(
  '/admin',
  validate({ body: trainerBody }),
  asyncHandler(async (req, res) => {
    const { name, email, phone, ...profile } = req.body as z.infer<typeof trainerBody>;
    if (await UserModel.exists({ email })) throw AppError.conflict('An account with this email already exists');
    // The trainer sets their own password via the reset-password email.
    const user = await UserModel.create({ name, email, phone: phone || undefined, passwordHash: await hashPassword(randomToken(24)), role: 'trainer', createdBy: req.user!.id, emailVerified: true });
    const p = await TrainerProfileModel.create({ ...profile, user: user._id });
    bumpContentVersion();
    await audit(req, { action: 'trainer.create', entity: 'User', entityId: user._id, summary: `Created trainer ${email}` });
    const { requestPasswordReset } = await import('../services/auth.service');
    await requestPasswordReset(email);
    created(res, { user: publicUser(user), profile: p, note: 'A password setup email was sent to the trainer.' });
  }),
);

admin.put(
  '/admin/:userId',
  validate({ body: trainerBody.omit({ email: true }).partial() }),
  asyncHandler(async (req, res) => {
    const { name, phone, ...profile } = req.body;
    const user = await UserModel.findOneAndUpdate({ _id: req.params.userId, role: 'trainer' }, { $set: { ...(name ? { name } : {}), ...(phone !== undefined ? { phone } : {}) } }, { new: true });
    if (!user) throw AppError.notFound('Trainer');
    const p = await TrainerProfileModel.findOneAndUpdate({ user: user._id }, { $set: profile }, { new: true, upsert: true, setDefaultsOnInsert: true });
    bumpContentVersion();
    await audit(req, { action: 'trainer.update', entity: 'User', entityId: user._id, summary: `Updated trainer ${user.email}` });
    ok(res, { user: publicUser(user), profile: p });
  }),
);

r.use('/', admin);
export default r;
