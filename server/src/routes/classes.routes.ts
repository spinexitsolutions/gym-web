import { Router } from 'express';
import { z } from 'zod';
import { hasPermission, requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BookingModel, GymClassModel, UserModel } from '../models';
import { audit } from '../services/audit.service';
import { cancelClass } from '../services/booking.service';
import { bumpContentVersion } from '../services/cms.service';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';
import { addDays } from '../utils/dates';
import { asyncHandler, created, ok } from '../utils/http';

const r = Router();
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(31).default(7),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  trainer: objectId.optional(),
});

/** Public schedule (no attendee data). */
r.get(
  '/',
  validate({ query: rangeQuery }),
  asyncHandler(async (_req, res) => {
    const { from, to, days, limit, trainer } = res.locals.query as z.infer<typeof rangeQuery>;
    const start = from ?? new Date();
    const end = to ?? addDays(start, days);
    const classes = await GymClassModel.find({ status: { $in: ['scheduled', 'cancelled'] }, startsAt: { $gte: start, $lt: end }, ...(trainer ? { trainer } : {}) })
      .populate('trainer', 'name')
      .populate('program', 'title slug')
      .sort({ startsAt: 1 })
      .limit(limit)
      .lean();
    ok(
      res,
      classes.map((c) => ({
        id: String(c._id),
        title: c.title,
        description: c.description,
        trainer: c.trainer ? { id: String((c.trainer as unknown as { _id: unknown })._id), name: (c.trainer as unknown as { name: string }).name } : null,
        program: c.program,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        capacity: c.capacity,
        spotsLeft: Math.max(0, c.capacity - c.bookedCount),
        waitlistCount: c.waitlistCount,
        location: c.location,
        level: c.level,
        status: c.status,
      })),
    );
  }),
);

/** Roster: the class's trainer or staff with classes:write / attendance:write. */
r.get(
  '/:id/roster',
  requireAuth,
  asyncHandler(async (req, res) => {
    const c = await GymClassModel.findById(req.params.id).lean();
    if (!c) throw AppError.notFound('Class');
    const isTrainer = req.user!.role === 'trainer' && String(c.trainer) === req.user!.id;
    if (!isTrainer && !hasPermission(req.user, 'classes:write') && !hasPermission(req.user, 'attendance:write')) throw AppError.notFound('Class');
    const bookings = await BookingModel.find({ gymClass: c._id, status: { $ne: 'cancelled' } }).populate('user', 'name email phone avatarUrl').sort({ status: 1, waitlistedAt: 1, createdAt: 1 }).lean();
    ok(res, { class: c, bookings });
  }),
);

const classBody = z
  .object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).default(''),
    program: objectId.optional().nullable(),
    trainer: objectId.optional().nullable(),
    startsAt: z.coerce.date(),
    durationMin: z.number().int().min(15).max(300),
    capacity: z.number().int().min(1).max(500),
    location: z.string().trim().max(80).default(''),
    level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).default('all'),
    /** Create a weekly series: number of additional weekly occurrences. */
    repeatWeeks: z.number().int().min(0).max(26).default(0),
  })
  .refine((b) => b.startsAt.getTime() > Date.now() - 3600000, { path: ['startsAt'], message: 'Start time must be in the future' });

const admin = Router();
admin.use(requireAuth, requirePermission('classes:write'));

async function assertTrainer(id?: string | null) {
  if (!id) return;
  const t = await UserModel.exists({ _id: id, role: 'trainer', status: 'active' });
  if (!t) throw AppError.validation('Trainer not found', [{ path: 'body.trainer', message: 'Choose an active trainer' }]);
}

async function assertNoTrainerClash(trainer: string | null | undefined, startsAt: Date, endsAt: Date, excludeId?: string) {
  if (!trainer) return;
  const clash = await GymClassModel.exists({ trainer, status: 'scheduled', startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (clash) throw AppError.conflict(`The trainer already has a class at ${startsAt.toISOString()}`);
}

admin.post(
  '/',
  validate({ body: classBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof classBody>;
    await assertTrainer(b.trainer);
    const seriesId = b.repeatWeeks > 0 ? randomToken(8) : undefined;
    const docs = [];
    for (let i = 0; i <= b.repeatWeeks; i++) {
      const startsAt = addDays(b.startsAt, i * 7);
      const endsAt = new Date(startsAt.getTime() + b.durationMin * 60000);
      await assertNoTrainerClash(b.trainer, startsAt, endsAt);
      docs.push({ title: b.title, description: b.description, program: b.program || undefined, trainer: b.trainer || undefined, startsAt, endsAt, capacity: b.capacity, location: b.location, level: b.level, seriesId, createdBy: req.user!.id });
    }
    const createdDocs = await GymClassModel.insertMany(docs);
    bumpContentVersion();
    await audit(req, { action: 'class.create', entity: 'GymClass', entityId: createdDocs[0]._id, summary: `Created ${createdDocs.length} class session(s): ${b.title}` });
    created(res, createdDocs);
  }),
);

admin.patch(
  '/:id',
  validate({
    body: z.object({
      title: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(1000).optional(),
      trainer: objectId.optional().nullable(),
      program: objectId.optional().nullable(),
      startsAt: z.coerce.date().optional(),
      durationMin: z.number().int().min(15).max(300).optional(),
      capacity: z.number().int().min(1).max(500).optional(),
      location: z.string().trim().max(80).optional(),
      level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const c = await GymClassModel.findById(req.params.id);
    if (!c || c.status !== 'scheduled') throw AppError.notFound('Scheduled class');
    const b = req.body;
    if (b.trainer !== undefined) await assertTrainer(b.trainer);
    if (b.capacity !== undefined && b.capacity < c.bookedCount) throw AppError.conflict(`Capacity cannot be lower than current bookings (${c.bookedCount})`);
    const startsAt = b.startsAt ?? c.startsAt;
    const duration = b.durationMin ?? Math.round((c.endsAt.getTime() - c.startsAt.getTime()) / 60000);
    const endsAt = new Date(startsAt.getTime() + duration * 60000);
    await assertNoTrainerClash(b.trainer !== undefined ? b.trainer : String(c.trainer ?? ''), startsAt, endsAt, String(c._id));
    Object.assign(c, { ...b, startsAt, endsAt });
    if (b.trainer === null) c.trainer = undefined;
    if (b.program === null) c.program = undefined;
    delete (c as unknown as Record<string, unknown>).durationMin;
    await c.save();
    if (b.startsAt || b.durationMin) await BookingModel.updateMany({ gymClass: c._id, active: true }, { $set: { startsAt, endsAt } });
    bumpContentVersion();
    await audit(req, { action: 'class.update', entity: 'GymClass', entityId: c._id, summary: `Updated class ${c.title}` });
    ok(res, c);
  }),
);

admin.post(
  '/:id/cancel',
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  asyncHandler(async (req, res) => {
    const result = await cancelClass(req.user!, req.params.id, req.body.reason);
    bumpContentVersion();
    await audit(req, { action: 'class.cancel', entity: 'GymClass', entityId: req.params.id, summary: `Cancelled ${result.gymClass.title} (${result.affected} bookings notified)` });
    ok(res, result);
  }),
);

admin.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const hasBookings = await BookingModel.exists({ gymClass: req.params.id });
    if (hasBookings) throw AppError.conflict('This class has bookings. Cancel it instead so members are notified.');
    const c = await GymClassModel.findByIdAndDelete(req.params.id);
    if (!c) throw AppError.notFound('Class');
    bumpContentVersion();
    await audit(req, { action: 'class.delete', entity: 'GymClass', entityId: c._id, summary: `Deleted class ${c.title}` });
    ok(res, { deleted: true });
  }),
);

r.use('/', admin);
export default r;
