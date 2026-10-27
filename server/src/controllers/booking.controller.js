import { z } from 'zod';
import { Booking, ClassSchedule, Trainer } from '../models/index.js';
import * as svc from '../services/booking.service.js';
import { audit } from '../services/audit.service.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate } from '../utils/pagination.js';
import { gymDay, gymLocalToUtc, addDays, dayOfWeek } from '../utils/dates.js';
import { randomToken } from '../utils/crypto.js';
import { sendCsv } from '../utils/csv.js';
import { objectId } from '../validators/common.js';
import { classSchema, classBase } from '../validators/admin.validator.js';

const STAFF = ['owner', 'admin', 'staff'];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const slotsQuery = z.object({ date: day });
export async function slots(req, res) {
  const trainer = await Trainer.findOne({ _id: req.params.id, isActive: true });
  if (!trainer) throw ApiError.notFound('Trainer not found');
  const list = await svc.trainerSlots(trainer, req.query.date);
  return ok(res, { trainer: { id: trainer._id, name: trainer.name, sessionDurationMin: trainer.sessionDurationMin }, date: req.query.date, slots: list });
}

export const ptSchema = z.object({ trainerId: objectId, startAt: z.coerce.date(), notes: z.string().trim().max(500).optional() });
export async function bookPT(req, res) {
  return created(res, await svc.bookPersonalTraining(req.user, req.body), 'Session booked');
}

export async function bookClass(req, res) {
  const b = await svc.bookClass(req.user, req.params.id);
  return created(res, b, b.status === 'waitlisted' ? 'Added to the waitlist' : 'Class booked');
}

export async function mine(req, res) {
  const items = await Booking.find({ member: req.user._id })
    .populate('trainer', 'name slug photo')
    .populate('classSchedule', 'title location')
    .sort('-startAt').limit(200).lean();
  const now = new Date();
  const position = async (b) => (b.status === 'waitlisted' ? 1 + await Booking.countDocuments({ classSchedule: b.classSchedule?._id, status: 'waitlisted', waitlistedAt: { $lt: b.waitlistedAt } }) : undefined);
  const upcoming = await Promise.all(items.filter((b) => b.endAt >= now && ['booked', 'waitlisted'].includes(b.status)).reverse().map(async (b) => ({ ...b, waitlistPosition: await position(b) })));
  return ok(res, { upcoming, past: items.filter((b) => !(b.endAt >= now && ['booked', 'waitlisted'].includes(b.status))) });
}

async function loadOwned(req) {
  const b = await Booking.findById(req.params.id);
  if (!b) throw ApiError.notFound('Booking not found');
  const own = String(b.member) === String(req.user._id);
  if (!own && !STAFF.includes(req.user.role)) {
    const t = req.user.role === 'trainer' ? await Trainer.findOne({ user: req.user._id }).select('_id') : null;
    if (!t || String(t._id) !== String(b.trainer)) throw ApiError.forbidden();
  }
  return b;
}

export async function cancel(req, res) {
  const b = await loadOwned(req);
  return ok(res, await svc.cancelBooking(b, req.user, req.body.reason), { message: 'Booking cancelled' });
}

export async function reschedule(req, res) {
  const b = await loadOwned(req);
  return ok(res, await svc.reschedulePersonalTraining(req.user, b, req.body.startAt), { message: 'Session rescheduled' });
}

// ---- Trainer ----
async function myTrainer(req) {
  const t = await Trainer.findOne({ user: req.user._id });
  if (!t) throw ApiError.notFound('Your account is not linked to a trainer profile yet. Ask an admin to link it.');
  return t;
}

export async function trainerSchedule(req, res) {
  const t = await myTrainer(req);
  const from = req.query.from ? new Date(req.query.from) : addDays(new Date(), -1);
  const to = req.query.to ? new Date(req.query.to) : addDays(new Date(), 30);
  const [bookings, classes] = await Promise.all([
    Booking.find({ trainer: t._id, type: 'personal_training', startAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } }).populate('member', 'name email phone avatar').sort('startAt').lean(),
    ClassSchedule.find({ trainer: t._id, startAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } }).sort('startAt').lean(),
  ]);
  return ok(res, { trainer: t, bookings, classes });
}

// ---- Staff ----
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['personal_training', 'class']).optional(), status: z.enum(['booked', 'waitlisted', 'cancelled', 'completed', 'no_show']).optional(),
  trainer: objectId.optional(), member: objectId.optional(), from: day.optional(), to: day.optional(), sort: z.string().max(20).optional(),
});

function staffFilter(q) {
  const f = {};
  for (const k of ['type', 'status', 'trainer', 'member']) if (q[k]) f[k] = q[k];
  if (q.from || q.to) {
    f.startAt = {};
    if (q.from) f.startAt.$gte = gymLocalToUtc(q.from, '00:00');
    if (q.to) f.startAt.$lt = gymLocalToUtc(gymDay(addDays(new Date(`${q.to}T12:00:00Z`), 1)), '00:00');
  }
  return f;
}

export async function list(req, res) {
  const opts = parsePagination(req.query, { sortable: ['startAt', 'createdAt'], defaultSort: '-startAt' });
  const { items, meta } = await paginate(Booking, staffFilter(req.query), opts, {
    populate: [{ path: 'member', select: 'name email phone' }, { path: 'trainer', select: 'name' }, { path: 'classSchedule', select: 'title' }],
  });
  return ok(res, items, { meta });
}

export async function exportCsv(req, res) {
  const rows = await Booking.find(staffFilter(req.query)).populate('member', 'name email').populate('trainer', 'name').populate('classSchedule', 'title').sort('-startAt').limit(20000).lean();
  return sendCsv(res, 'bookings.csv', rows, [
    { label: 'Start', value: 'startAt' }, { label: 'Type', value: 'type' }, { label: 'Status', value: 'status' },
    { label: 'Member', value: (r) => r.member?.name }, { label: 'Email', value: (r) => r.member?.email },
    { label: 'Trainer', value: (r) => r.trainer?.name }, { label: 'Class', value: (r) => r.classSchedule?.title },
  ]);
}

export const statusSchema = z.object({ status: z.enum(['completed', 'no_show', 'cancelled']), reason: z.string().trim().max(300).optional() });
export async function setStatus(req, res) {
  const b = await loadOwned(req);
  if (req.user.role === 'member') throw ApiError.forbidden();
  if (req.body.status === 'cancelled') return ok(res, await svc.cancelBooking(b, req.user, req.body.reason), { message: 'Booking cancelled' });
  if (b.status !== 'booked') throw ApiError.badRequest('Only booked sessions can be marked');
  if (b.startAt > new Date()) throw ApiError.badRequest('You can mark a session after it starts');
  b.status = req.body.status;
  await b.save();
  await audit(req, { action: `booking.${req.body.status}`, entity: 'Booking', entityId: b._id });
  return ok(res, b, { message: 'Updated' });
}

// ---- Classes ----
export const classesQuery = z.object({ from: day.optional(), to: day.optional(), trainer: objectId.optional(), program: objectId.optional(), includeCancelled: z.enum(['true']).optional() });

export async function listClasses(req, res) {
  const from = req.query.from ? gymLocalToUtc(req.query.from, '00:00') : new Date();
  const to = req.query.to ? gymLocalToUtc(gymDay(addDays(new Date(`${req.query.to}T12:00:00Z`), 1)), '00:00') : addDays(from, 14);
  const filter = { startAt: { $gte: from, $lt: to } };
  if (!req.query.includeCancelled) filter.status = 'scheduled';
  if (req.query.trainer) filter.trainer = req.query.trainer;
  if (req.query.program) filter.program = req.query.program;
  const classes = await ClassSchedule.find(filter).populate('trainer', 'name slug photo').populate('program', 'title slug category').populate('eligiblePlans', 'name').sort('startAt').limit(500).lean();
  let mine = {};
  if (req.user) {
    const own = await Booking.find({ member: req.user._id, classSchedule: { $in: classes.map((c) => c._id) }, status: { $in: ['booked', 'waitlisted'] } }).select('classSchedule status').lean();
    mine = Object.fromEntries(own.map((b) => [String(b.classSchedule), { id: b._id, status: b.status }]));
  }
  return ok(res, classes.map((c) => ({ ...c, spotsLeft: Math.max(0, c.capacity - c.bookedCount), myBooking: mine[String(c._id)] || null })));
}

async function assertTrainerFree(trainerId, startAt, endAt, excludeClassId) {
  const clash = await ClassSchedule.exists({ trainer: trainerId, status: 'scheduled', startAt: { $lt: endAt }, endAt: { $gt: startAt }, ...(excludeClassId && { _id: { $ne: excludeClassId } }) })
    || await Booking.exists({ trainer: trainerId, type: 'personal_training', status: 'booked', startAt: { $lt: endAt }, endAt: { $gt: startAt } });
  if (clash) throw ApiError.conflict('The trainer already has a class or session at this time');
}

export async function createClass(req, res) {
  await assertTrainerFree(req.body.trainer, req.body.startAt, req.body.endAt);
  const cls = await ClassSchedule.create(req.body);
  await audit(req, { action: 'class.create', entity: 'ClassSchedule', entityId: cls._id, summary: cls.title });
  return created(res, cls, 'Class scheduled');
}

export const seriesSchema = classBase.omit({ startAt: true, endAt: true }).extend({
  startDate: day, weeks: z.coerce.number().int().min(1).max(26), daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), durationMin: z.coerce.number().int().min(15).max(240),
});

export async function createSeries(req, res) {
  const { startDate, weeks, daysOfWeek, startTime, durationMin, ...base } = req.body;
  const seriesId = randomToken(8);
  const docs = [];
  let skipped = 0;
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = gymDay(addDays(new Date(`${startDate}T12:00:00Z`), i));
    if (!daysOfWeek.includes(dayOfWeek(d))) continue;
    const startAt = gymLocalToUtc(d, startTime);
    const endAt = new Date(startAt.getTime() + durationMin * 60000);
    if (startAt <= new Date()) { skipped += 1; continue; }
    try { await assertTrainerFree(base.trainer, startAt, endAt); } catch { skipped += 1; continue; }
    docs.push({ ...base, startAt, endAt, seriesId });
  }
  if (!docs.length) throw ApiError.badRequest('No classes could be created (all dates are in the past or clash with the trainer’s schedule)');
  const createdDocs = await ClassSchedule.insertMany(docs);
  await audit(req, { action: 'class.series_create', entity: 'ClassSchedule', entityId: seriesId, summary: `${createdDocs.length} classes, ${skipped} skipped` });
  return created(res, { created: createdDocs.length, skipped, seriesId }, `${createdDocs.length} classes scheduled${skipped ? `, ${skipped} skipped` : ''}`);
}

export async function updateClass(req, res) {
  const cls = await ClassSchedule.findById(req.params.id);
  if (!cls || cls.status !== 'scheduled') throw ApiError.notFound('Scheduled class not found');
  const next = { ...cls.toObject(), ...req.body };
  if (next.endAt <= next.startAt) throw ApiError.badRequest('End must be after start');
  if (req.body.capacity !== undefined && req.body.capacity < cls.bookedCount) throw ApiError.badRequest(`Capacity cannot be lower than the ${cls.bookedCount} members already booked`);
  const timeChanged = (req.body.startAt && +req.body.startAt !== +cls.startAt) || (req.body.endAt && +req.body.endAt !== +cls.endAt);
  if (timeChanged || req.body.trainer) await assertTrainerFree(next.trainer, next.startAt, next.endAt, cls._id);
  cls.set(req.body);
  await cls.save();
  if (timeChanged) await svc.rescheduleClass(cls, { startAt: cls.startAt, endAt: cls.endAt });
  if (req.body.capacity) await svc.promoteWaitlist(cls._id);
  await audit(req, { action: 'class.update', entity: 'ClassSchedule', entityId: cls._id, changes: { fields: Object.keys(req.body) } });
  return ok(res, cls, { message: timeChanged ? 'Class updated and members notified' : 'Class updated' });
}

export async function cancelClass(req, res) {
  const cls = await ClassSchedule.findById(req.params.id);
  if (!cls || cls.status !== 'scheduled') throw ApiError.notFound('Scheduled class not found');
  const n = await svc.cancelClass(cls, req.user, req.body.reason);
  await audit(req, { action: 'class.cancel', entity: 'ClassSchedule', entityId: cls._id, summary: `${n} bookings cancelled` });
  return ok(res, cls, { message: `Class cancelled; ${n} members notified` });
}

export async function roster(req, res) {
  const cls = await ClassSchedule.findById(req.params.id).populate('trainer', 'name user').lean();
  if (!cls) throw ApiError.notFound('Class not found');
  if (!STAFF.includes(req.user.role) && String(cls.trainer?.user) !== String(req.user._id)) throw ApiError.forbidden();
  const bookings = await Booking.find({ classSchedule: cls._id, status: { $ne: 'cancelled' } }).populate('member', 'name email phone').sort('status waitlistedAt createdAt').lean();
  return ok(res, { class: cls, bookings });
}

export { classSchema };
