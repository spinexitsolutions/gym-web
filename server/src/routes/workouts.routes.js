import { Router } from 'express';
import { z } from 'zod';
import { WorkoutPlan, ProgressEntry, MemberProfile, Trainer, User } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { idParam, objectId } from '../validators/common.js';
import { notify } from '../services/notification.service.js';

const r = Router();
r.use(authenticate);
const STAFF = ['owner', 'admin', 'staff'];

// Trainers may only work with members assigned to them; staff with anyone.
async function assertCanCoach(user, memberId) {
  if (STAFF.includes(user.role)) return null;
  if (user.role !== 'trainer') throw ApiError.forbidden();
  const trainer = await Trainer.findOne({ user: user._id }).select('_id');
  const assigned = trainer && await MemberProfile.exists({ user: memberId, assignedTrainer: trainer._id });
  if (!assigned) throw ApiError.forbidden('This member is not assigned to you');
  return trainer;
}

// ---- Progress (members log their own; coaches can read) ----
const progressSchema = z.object({
  date: z.coerce.date().max(new Date(Date.now() + 864e5), 'Date cannot be in the future'),
  weightKg: z.coerce.number().min(20).max(400).optional(),
  bodyFatPct: z.coerce.number().min(2).max(70).optional(),
  measurements: z.object({
    chestCm: z.coerce.number().min(30).max(250).optional(), waistCm: z.coerce.number().min(30).max(250).optional(),
    hipsCm: z.coerce.number().min(30).max(250).optional(), armCm: z.coerce.number().min(10).max(100).optional(), thighCm: z.coerce.number().min(20).max(150).optional(),
  }).optional(),
  note: z.string().trim().max(500).optional(),
}).refine((p) => p.weightKg || p.bodyFatPct || (p.measurements && Object.values(p.measurements).some(Boolean)), 'Enter at least one measurement');

r.get('/progress', h(async (req, res) => ok(res, await ProgressEntry.find({ user: req.user._id }).sort('date').limit(500).lean())));
r.post('/progress', validate({ body: progressSchema }), h(async (req, res) => created(res, await ProgressEntry.create({ ...req.body, user: req.user._id }), 'Progress saved')));
r.delete('/progress/:id', validate({ params: idParam }), h(async (req, res) => {
  const d = await ProgressEntry.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!d.deletedCount) throw ApiError.notFound('Entry not found');
  return ok(res, null, { message: 'Entry deleted' });
}));
r.get('/progress/:memberId', authorize('admin', 'staff', 'trainer'), validate({ params: z.object({ memberId: objectId }) }), h(async (req, res) => {
  await assertCanCoach(req.user, req.params.memberId);
  return ok(res, await ProgressEntry.find({ user: req.params.memberId }).sort('date').limit(500).lean());
}));

// ---- Workout plans ----
const exercise = z.object({ name: z.string().trim().min(1).max(100), sets: z.coerce.number().int().min(1).max(20).optional(), reps: z.string().trim().max(20).optional(), restSec: z.coerce.number().int().min(0).max(600).optional(), notes: z.string().trim().max(300).optional() });
const planSchema = z.object({
  member: objectId, program: objectId.nullable().optional(), title: z.string().trim().min(2).max(100), goal: z.string().trim().max(200).optional(),
  startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(),
  days: z.array(z.object({ label: z.string().trim().min(1).max(40), exercises: z.array(exercise).min(1).max(30) })).min(1).max(14),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
});

r.get('/me', h(async (req, res) => ok(res, await WorkoutPlan.find({ member: req.user._id, status: { $ne: 'archived' } }).populate('trainer', 'name photo').populate('program', 'title slug').sort('-createdAt').lean())));

r.get('/plans', authorize('admin', 'staff', 'trainer'), validate({ query: z.object({ member: objectId.optional() }) }), h(async (req, res) => {
  const filter = {};
  if (req.query.member) { await assertCanCoach(req.user, req.query.member); filter.member = req.query.member; }
  if (req.user.role === 'trainer') filter.trainer = (await Trainer.findOne({ user: req.user._id }).select('_id'))?._id || null;
  return ok(res, await WorkoutPlan.find(filter).populate('member', 'name email').populate('trainer', 'name').sort('-updatedAt').limit(200).lean());
}));

r.post('/plans', authorize('admin', 'staff', 'trainer'), validate({ body: planSchema }), h(async (req, res) => {
  const trainer = await assertCanCoach(req.user, req.body.member);
  if (!(await User.exists({ _id: req.body.member, role: 'member' }))) throw ApiError.badRequest('Member not found');
  const plan = await WorkoutPlan.create({ ...req.body, trainer: trainer?._id });
  await notify(req.body.member, { type: 'system', title: 'New workout plan', body: `${req.body.title} is ready in your dashboard.`, link: '/dashboard/workouts' });
  return created(res, plan, 'Workout plan assigned');
}));

r.patch('/plans/:id', authorize('admin', 'staff', 'trainer'), validate({ params: idParam, body: planSchema.partial() }), h(async (req, res) => {
  const plan = await WorkoutPlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  await assertCanCoach(req.user, plan.member);
  plan.set({ ...req.body, member: plan.member });
  await plan.save();
  return ok(res, plan, { message: 'Plan updated' });
}));

r.delete('/plans/:id', authorize('admin', 'staff', 'trainer'), validate({ params: idParam }), h(async (req, res) => {
  const plan = await WorkoutPlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  await assertCanCoach(req.user, plan.member);
  await plan.deleteOne();
  return ok(res, null, { message: 'Plan deleted' });
}));

export default r;
