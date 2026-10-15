import { Router } from 'express';
import { z } from 'zod';
import { mediaUrl, slugSchema } from '@apex/shared';
import { hasPermission, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ExerciseModel, WorkoutPlanModel } from '../models';
import { assertCanAccessMember } from '../services/access.service';
import { notifyLater } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex } from '../utils/pagination';

const r = Router();
r.use(requireAuth);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

/* Exercise library: readable by any signed-in user, editable by trainers/admins. */
r.get(
  '/exercises',
  validate({ query: z.object({ q: z.string().trim().max(60).optional(), category: z.string().trim().max(30).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { q, category } = res.locals.query;
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
    ok(res, await ExerciseModel.find(filter).sort({ name: 1 }).limit(500).lean());
  }),
);

const exerciseBody = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  category: z.enum(['strength', 'cardio', 'mobility', 'conditioning', 'core', 'olympic', 'other']),
  muscleGroups: z.array(z.string().trim().max(30)).max(10).default([]),
  equipment: z.array(z.string().trim().max(30)).max(10).default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  instructions: z.string().trim().max(4000).default(''),
  mediaUrl: mediaUrl.default(''),
  videoUrl: z.string().trim().url().startsWith('https://').or(z.literal('')).default(''),
});

r.post('/exercises', requireRole('admin', 'trainer'), validate({ body: exerciseBody }), asyncHandler(async (req, res) => created(res, await ExerciseModel.create({ ...req.body, createdBy: req.user!.id }))));
r.put(
  '/exercises/:id',
  requireRole('admin', 'trainer'),
  validate({ body: exerciseBody }),
  asyncHandler(async (req, res) => {
    const e = await ExerciseModel.findById(req.params.id);
    if (!e) throw AppError.notFound('Exercise');
    if (req.user!.role === 'trainer' && String(e.createdBy) !== req.user!.id) throw AppError.forbidden('You can only edit exercises you created');
    Object.assign(e, req.body);
    await e.save();
    ok(res, e);
  }),
);
r.delete(
  '/exercises/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const e = await ExerciseModel.findByIdAndDelete(req.params.id);
    if (!e) throw AppError.notFound('Exercise');
    ok(res, { deleted: true });
  }),
);

/* Workout plans */
const planBody = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  member: objectId.optional().nullable(),
  isTemplate: z.boolean().default(false),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.enum(['active', 'archived']).default('active'),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        focus: z.string().trim().max(100).default(''),
        exercises: z
          .array(
            z.object({
              exercise: objectId.optional().nullable(),
              name: z.string().trim().min(1).max(100),
              sets: z.number().int().min(1).max(20).default(3),
              reps: z.string().trim().max(20).default('10'),
              weightKg: z.number().min(0).max(1000).optional().nullable(),
              restSec: z.number().int().min(0).max(900).default(90),
              tempo: z.string().trim().max(20).default(''),
              notes: z.string().trim().max(300).default(''),
            }),
          )
          .max(30),
      }),
    )
    .max(14),
});

/** Members see their own plans; trainers see plans they own; admins see all. */
r.get(
  '/plans',
  validate({ query: z.object({ member: objectId.optional(), templates: z.enum(['true', 'false']).optional() }) }),
  asyncHandler(async (req, res) => {
    const { member, templates } = res.locals.query;
    const filter: Record<string, unknown> = {};
    if (req.user!.role === 'member') filter.member = req.user!.id;
    else {
      if (req.user!.role === 'trainer' && !hasPermission(req.user, 'members:read')) filter.trainer = req.user!.id;
      if (member) {
        await assertCanAccessMember(req.user!, member);
        filter.member = member;
        delete filter.trainer;
      }
      if (templates) filter.isTemplate = templates === 'true';
    }
    ok(res, await WorkoutPlanModel.find(filter).populate('member', 'name').populate('trainer', 'name').sort({ updatedAt: -1 }).limit(200).lean());
  }),
);

r.get(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const plan = await WorkoutPlanModel.findById(req.params.id).populate('member', 'name').populate('trainer', 'name').lean();
    if (!plan) throw AppError.notFound('Workout plan');
    const memberId = plan.member ? String((plan.member as unknown as { _id: unknown })._id) : null;
    const isOwnerTrainer = String((plan.trainer as unknown as { _id: unknown })._id) === req.user!.id;
    const allowed = isOwnerTrainer || (memberId && memberId === req.user!.id) || hasPermission(req.user, 'members:read') || (memberId && req.user!.role === 'trainer' && (await assertCanAccessMember(req.user!, memberId).then(() => true, () => false)));
    if (!allowed) throw AppError.notFound('Workout plan');
    ok(res, plan);
  }),
);

r.post(
  '/plans',
  requireRole('admin', 'trainer'),
  validate({ body: planBody }),
  asyncHandler(async (req, res) => {
    if (req.body.member) await assertCanAccessMember(req.user!, req.body.member);
    const plan = await WorkoutPlanModel.create({ ...req.body, member: req.body.isTemplate ? undefined : req.body.member || undefined, trainer: req.user!.id });
    if (plan.member) notifyLater({ userId: plan.member, type: 'workout', title: 'New workout plan', body: `${req.user!.name} assigned you "${plan.title}".`, link: '/member/workouts', dedupeKey: `plan-assigned:${plan._id}` });
    created(res, plan);
  }),
);

r.put(
  '/plans/:id',
  requireRole('admin', 'trainer'),
  validate({ body: planBody }),
  asyncHandler(async (req, res) => {
    const plan = await WorkoutPlanModel.findById(req.params.id);
    if (!plan) throw AppError.notFound('Workout plan');
    if (req.user!.role === 'trainer' && String(plan.trainer) !== req.user!.id) throw AppError.notFound('Workout plan');
    if (req.body.member) await assertCanAccessMember(req.user!, req.body.member);
    const wasMember = plan.member ? String(plan.member) : null;
    Object.assign(plan, { ...req.body, member: req.body.isTemplate ? undefined : req.body.member || undefined });
    await plan.save();
    if (plan.member && String(plan.member) !== wasMember) notifyLater({ userId: plan.member, type: 'workout', title: 'New workout plan', body: `You've been assigned "${plan.title}".`, link: '/member/workouts', dedupeKey: `plan-assigned:${plan._id}:${plan.member}` });
    ok(res, plan);
  }),
);

r.delete(
  '/plans/:id',
  requireRole('admin', 'trainer'),
  asyncHandler(async (req, res) => {
    const plan = await WorkoutPlanModel.findOneAndDelete({ _id: req.params.id, ...(req.user!.role === 'trainer' ? { trainer: req.user!.id } : {}) });
    if (!plan) throw AppError.notFound('Workout plan');
    ok(res, { deleted: true });
  }),
);

export default r;
