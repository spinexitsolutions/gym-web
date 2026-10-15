import { Router } from 'express';
import { z } from 'zod';
import { hasPermission, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AttendanceModel } from '../models';
import { assignedMemberIds } from '../services/access.service';
import * as attendance from '../services/attendance.service';
import { getSiteSettings } from '../services/settings.service';
import { AppError } from '../utils/AppError';
import { dayKey } from '../utils/dates';
import { asyncHandler, created, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';

const r = Router();
r.use(requireAuth);

r.get(
  '/me',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit } = res.locals.query;
    const filter = { user: req.user!.id };
    const [items, total] = await Promise.all([AttendanceModel.find(filter).populate('gymClass', 'title').sort({ checkInAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AttendanceModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

r.get(
  '/me/qr',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    ok(res, { payload: attendance.qrPayload(await attendance.getOrCreateQrToken(req.user!.id)) });
  }),
);

r.post(
  '/me/qr/rotate',
  requireRole('member'),
  asyncHandler(async (req, res) => ok(res, { payload: attendance.qrPayload(await attendance.rotateQrToken(req.user!.id)) })),
);

const checkInBody = z.object({ qr: z.string().trim().min(10).max(120).optional(), memberId: z.string().regex(/^[a-f0-9]{24}$/).optional() }).refine((b) => b.qr || b.memberId, 'Scan a QR code or choose a member');

r.post(
  '/check-in',
  requireRole('admin', 'trainer'),
  validate({ body: checkInBody }),
  asyncHandler(async (req, res) => created(res, await attendance.checkIn(req.user!, req.body))),
);

r.post('/:id/check-out', requireRole('admin', 'trainer'), asyncHandler(async (req, res) => ok(res, await attendance.checkOut(req.user!, req.params.id))));

/** Staff attendance list. Trainers only see their assigned members. */
r.get(
  '/',
  requireRole('admin', 'trainer'),
  validate({ query: listQuery.extend({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), user: z.string().regex(/^[a-f0-9]{24}$/).optional() }) }),
  asyncHandler(async (req, res) => {
    const { page, limit, day, user } = res.locals.query;
    const settings = await getSiteSettings();
    const filter: Record<string, unknown> = { day: day ?? dayKey(new Date(), settings.business.timezone) };
    if (user) {
      delete filter.day;
      filter.user = user;
    }
    if (!hasPermission(req.user, 'attendance:write') && !hasPermission(req.user, 'members:read')) {
      const ids = await assignedMemberIds(req.user!.id);
      if (user && !ids.some((i) => String(i) === user)) throw AppError.notFound('Member');
      filter.user = user ? user : { $in: ids };
    }
    const [items, total] = await Promise.all([
      AttendanceModel.find(filter).populate('user', 'name email avatarUrl').populate('gymClass', 'title').sort({ checkInAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AttendanceModel.countDocuments(filter),
    ]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

export default r;
