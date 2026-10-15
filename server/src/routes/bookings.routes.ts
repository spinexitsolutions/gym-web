import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth';
import { publicFormLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { BookingModel, UserModel } from '../models';
import { audit } from '../services/audit.service';
import * as bookings from '../services/booking.service';
import { notifyLater } from '../services/notification.service';
import { renderEmail, sendEmail } from '../services/email.service';
import { getSiteSettings } from '../services/settings.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';
import { trialSchema } from '../validators/content.validators';

const r = Router();
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

/** Public free-trial request. */
r.post(
  '/trial',
  publicFormLimiter,
  validate({ body: trialSchema }),
  asyncHandler(async (req, res) => {
    const b = await bookings.requestTrial(req.body);
    const settings = await getSiteSettings();
    await sendEmail({
      to: req.body.email,
      subject: `Your free trial request — ${settings.brand.name}`,
      text: `Thanks ${req.body.name}! We received your trial request for ${new Date(req.body.preferredDate).toDateString()}. Our team will confirm the time shortly.`,
      html: renderEmail({ brand: settings.brand.name, heading: 'Trial request received', paragraphs: [`Thanks ${req.body.name}!`, `We received your request for ${new Date(req.body.preferredDate).toDateString()}. Our team will call or email you to confirm a time.`] }),
    });
    created(res, { id: String(b._id), status: b.status });
  }),
);

r.use(requireAuth);

r.get(
  '/me',
  validate({ query: z.object({ scope: z.enum(['upcoming', 'past', 'all']).default('upcoming') }) }),
  asyncHandler(async (req, res) => {
    const { scope } = res.locals.query;
    const now = new Date();
    const filter: Record<string, unknown> = { user: req.user!.id };
    if (scope === 'upcoming') Object.assign(filter, { endsAt: { $gte: now }, status: { $in: ['confirmed', 'waitlisted', 'pending'] } });
    if (scope === 'past') Object.assign(filter, { $or: [{ endsAt: { $lt: now } }, { status: { $in: ['cancelled', 'attended', 'no_show'] } }] });
    const items = await BookingModel.find(filter).populate('gymClass', 'title location').populate('trainer', 'name').sort({ startsAt: scope === 'past' ? -1 : 1 }).limit(100).lean();
    ok(res, items);
  }),
);

r.post('/class', requireRole('member'), validate({ body: z.object({ classId: objectId }) }), asyncHandler(async (req, res) => created(res, await bookings.bookClass(req.user!.id, req.body.classId))));

r.post(
  '/pt',
  requireRole('member'),
  validate({ body: z.object({ trainerId: objectId, startsAt: z.coerce.date(), notes: z.string().trim().max(500).optional() }) }),
  asyncHandler(async (req, res) => created(res, await bookings.bookPersonalTraining(req.user!.id, req.body))),
);

r.get(
  '/pt/slots',
  validate({ query: z.object({ trainerId: objectId, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) }),
  asyncHandler(async (_req, res) => {
    const { trainerId, date } = res.locals.query;
    ok(res, await bookings.trainerSlots(trainerId, date));
  }),
);

r.post(
  '/:id/cancel',
  validate({ body: z.object({ reason: z.string().trim().max(300).optional() }) }),
  asyncHandler(async (req, res) => ok(res, await bookings.cancelBooking(req.user!, req.params.id, req.body.reason))),
);

r.post(
  '/:id/reschedule',
  requireRole('member'),
  validate({ body: z.object({ classId: objectId }) }),
  asyncHandler(async (req, res) => ok(res, await bookings.rescheduleClassBooking(req.user!, req.params.id, req.body.classId))),
);

r.post(
  '/:id/attendance',
  validate({ body: z.object({ status: z.enum(['attended', 'no_show']) }) }),
  asyncHandler(async (req, res) => ok(res, await bookings.markBookingAttendance(req.user!, req.params.id, req.body.status))),
);

/* Admin */
const adminList = listQuery.extend({
  type: z.enum(['class', 'personal_training', 'trial']).optional(),
  status: z.enum(['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

r.get(
  '/',
  requirePermission('classes:write'),
  validate({ query: adminList }),
  asyncHandler(async (_req, res) => {
    const { page, limit, type, status, from, to } = res.locals.query as z.infer<typeof adminList>;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (from || to) filter.startsAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const [items, total] = await Promise.all([
      BookingModel.find(filter).populate('user', 'name email phone').populate('trainer', 'name').populate('gymClass', 'title').sort({ startsAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BookingModel.countDocuments(filter),
    ]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

/** Trial request handling: confirm a time / assign a trainer / close. */
r.patch(
  '/:id/trial',
  requirePermission('classes:write'),
  validate({ body: z.object({ status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']), startsAt: z.coerce.date().optional(), trainerId: objectId.optional().nullable(), notes: z.string().trim().max(1000).optional() }) }),
  asyncHandler(async (req, res) => {
    const b = await BookingModel.findOne({ _id: req.params.id, type: 'trial' });
    if (!b) throw AppError.notFound('Trial request');
    if (req.body.trainerId) {
      const t = await UserModel.exists({ _id: req.body.trainerId, role: 'trainer' });
      if (!t) throw AppError.validation('Trainer not found');
      b.trainer = req.body.trainerId;
    }
    if (req.body.startsAt) {
      b.startsAt = req.body.startsAt;
      b.endsAt = new Date(req.body.startsAt.getTime() + 3600000);
    }
    b.status = req.body.status;
    b.active = ['pending', 'confirmed'].includes(req.body.status);
    if (req.body.notes) b.notes = req.body.notes;
    await b.save();
    if (req.body.status === 'confirmed' && b.guest?.email) {
      const settings = await getSiteSettings();
      await sendEmail({
        to: b.guest.email,
        subject: `Your free trial is confirmed — ${settings.brand.name}`,
        text: `Hi ${b.guest.name}, your trial session is confirmed for ${b.startsAt.toLocaleString('en-IN', { timeZone: settings.business.timezone })}.`,
        html: renderEmail({ brand: settings.brand.name, heading: 'Trial confirmed', paragraphs: [`Hi ${b.guest.name},`, `Your trial session is confirmed for ${b.startsAt.toLocaleString('en-IN', { timeZone: settings.business.timezone })}. Bring water, a towel and training shoes.`] }),
      });
    }
    if (b.trainer) notifyLater({ userId: b.trainer, type: 'booking', title: 'Trial session assigned', body: `${b.guest?.name} on ${b.startsAt.toUTCString()}`, link: '/trainer/schedule', dedupeKey: `trial-assign:${b._id}:${b.trainer}:${b.startsAt.getTime()}` });
    await audit(req, { action: 'trial.update', entity: 'Booking', entityId: b._id, summary: `Trial ${req.body.status}` });
    ok(res, b);
  }),
);

export default r;
