import { z } from 'zod';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { Attendance, User } from '../models/index.js';
import { currentMembership } from '../services/membership.service.js';
import { audit } from '../services/audit.service.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex } from '../utils/pagination.js';
import { gymDay, gymLocalToUtc, addDays } from '../utils/dates.js';
import { randomToken } from '../utils/crypto.js';
import { sendCsv } from '../utils/csv.js';
import { objectId } from '../validators/common.js';

const QR_TTL_SECONDS = 60;
const MIN_VISIT_MS = 5 * 60 * 1000; // a second scan within 5 minutes is treated as a duplicate, not a check-out
const QR_AUDIENCE = 'gym-checkin';

// Short-lived signed token. Contains only an opaque user id — no name, email or membership details.
export async function issueQr(req, res) {
  const m = await currentMembership(req.user._id);
  if (!m) throw ApiError.forbidden('Your membership is not active. Renew to check in.');
  const jti = randomToken(8);
  const token = jwt.sign({ sub: String(req.user._id), jti }, env.JWT_ACCESS_SECRET, { audience: QR_AUDIENCE, expiresIn: QR_TTL_SECONDS, algorithm: 'HS256' });
  return ok(res, { token, expiresAt: new Date(Date.now() + QR_TTL_SECONDS * 1000), ttlSeconds: QR_TTL_SECONDS });
}

async function toggleAttendance(memberId, { method, by, tokenId }) {
  const member = await User.findOne({ _id: memberId, role: 'member' }).select('name email avatar status');
  if (!member || member.status !== 'active') throw ApiError.forbidden('This account is not active');
  const membership = await currentMembership(member._id);
  if (!membership) throw new ApiError(403, `${member.name}'s membership is not active`, [{ field: 'membership', message: 'expired' }]);

  const day = gymDay();
  const now = new Date();
  const existing = await Attendance.findOne({ member: member._id, day }).select('+lastTokenId');
  if (tokenId && existing?.lastTokenId === tokenId) throw ApiError.conflict('This QR code was already scanned. Ask the member to refresh it.');

  let action;
  let record;
  if (!existing) {
    try {
      record = await Attendance.create({ member: member._id, day, checkInAt: now, method, recordedBy: by, lastTokenId: tokenId });
    } catch (err) {
      if (err.code === 11000) throw ApiError.conflict(`${member.name} has already checked in today`);
      throw err;
    }
    action = 'check_in';
  } else if (!existing.checkOutAt) {
    if (now - existing.checkInAt < MIN_VISIT_MS) throw ApiError.conflict(`${member.name} checked in a moment ago`);
    existing.checkOutAt = now;
    existing.lastTokenId = tokenId;
    record = await existing.save();
    action = 'check_out';
  } else {
    throw ApiError.conflict(`${member.name} has already checked in and out today`);
  }
  return {
    action,
    attendance: record,
    member: { id: member._id, name: member.name, avatar: member.avatar?.url ? member.avatar : null },
    membership: { plan: membership.plan?.name, endDate: membership.endDate, daysLeft: Math.ceil((membership.endDate - now) / 864e5) },
  };
}

export async function scan(req, res) {
  let payload;
  try {
    payload = jwt.verify(req.body.token, env.JWT_ACCESS_SECRET, { audience: QR_AUDIENCE, algorithms: ['HS256'] });
  } catch (err) {
    throw ApiError.badRequest(err.name === 'TokenExpiredError' ? 'QR code expired — ask the member to refresh it' : 'Invalid QR code');
  }
  const result = await toggleAttendance(payload.sub, { method: 'qr', by: req.user._id, tokenId: payload.jti });
  return ok(res, result, { message: `${result.member.name} ${result.action === 'check_in' ? 'checked in' : 'checked out'}` });
}

export const manualSchema = z.object({ memberId: objectId });
export async function manual(req, res) {
  const result = await toggleAttendance(req.body.memberId, { method: 'staff', by: req.user._id });
  await audit(req, { action: `attendance.manual_${result.action}`, entity: 'Attendance', entityId: result.attendance._id });
  return created(res, result, `${result.member.name} ${result.action === 'check_in' ? 'checked in' : 'checked out'}`);
}

export const correctionSchema = z.object({
  checkInAt: z.coerce.date().optional(), checkOutAt: z.coerce.date().nullable().optional(),
  reason: z.string().trim().min(3, 'A reason is required for corrections').max(300),
});

export async function correct(req, res) {
  const a = await Attendance.findById(req.params.id);
  if (!a) throw ApiError.notFound('Attendance record not found');
  const before = { checkInAt: a.checkInAt, checkOutAt: a.checkOutAt };
  if (req.body.checkInAt) a.checkInAt = req.body.checkInAt;
  if (req.body.checkOutAt !== undefined) a.checkOutAt = req.body.checkOutAt || undefined;
  if (a.checkOutAt && a.checkOutAt <= a.checkInAt) throw ApiError.badRequest('Check-out must be after check-in');
  a.corrections.push({ by: req.user._id, reason: req.body.reason, before, after: { checkInAt: a.checkInAt, checkOutAt: a.checkOutAt } });
  await a.save();
  await audit(req, { action: 'attendance.correct', entity: 'Attendance', entityId: a._id, summary: req.body.reason, changes: { before, after: { checkInAt: a.checkInAt, checkOutAt: a.checkOutAt } } });
  return ok(res, a, { message: 'Attendance corrected' });
}

export async function remove(req, res) {
  const a = await Attendance.findById(req.params.id);
  if (!a) throw ApiError.notFound('Attendance record not found');
  await a.deleteOne();
  await audit(req, { action: 'attendance.delete', entity: 'Attendance', entityId: a._id, summary: req.body?.reason, changes: { day: a.day, member: a.member } });
  return ok(res, null, { message: 'Attendance record removed' });
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
  from: day.optional(), to: day.optional(), member: objectId.optional(), q: z.string().trim().max(100).optional(),
});

async function filterFrom(q) {
  const f = {};
  if (q.from || q.to) { f.day = {}; if (q.from) f.day.$gte = q.from; if (q.to) f.day.$lte = q.to; }
  if (!q.from && !q.to) f.day = gymDay();
  if (q.member) f.member = q.member;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const users = await User.find({ role: 'member', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id').limit(200).lean();
    f.member = { $in: users.map((u) => u._id) };
  }
  return f;
}

export async function list(req, res) {
  const filter = await filterFrom(req.query);
  const { items, meta } = await paginate(Attendance, filter, parsePagination(req.query, { defaultLimit: 50, sortable: ['checkInAt'], defaultSort: '-checkInAt' }), {
    populate: [{ path: 'member', select: 'name email phone avatar' }, { path: 'recordedBy', select: 'name' }],
  });
  return ok(res, items, { meta });
}

export async function exportCsv(req, res) {
  const rows = await Attendance.find(await filterFrom(req.query)).populate('member', 'name email').sort('-checkInAt').limit(50000).lean();
  return sendCsv(res, 'attendance.csv', rows, [
    { label: 'Day', value: 'day' }, { label: 'Member', value: (r) => r.member?.name }, { label: 'Email', value: (r) => r.member?.email },
    { label: 'Check-in', value: 'checkInAt' }, { label: 'Check-out', value: 'checkOutAt' }, { label: 'Method', value: 'method' },
    { label: 'Corrected', value: (r) => (r.corrections?.length ? 'yes' : '') },
  ]);
}

export const reportQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

// Daily totals for a month plus peak hours, computed in the gym's time zone.
export async function report(req, res) {
  const month = req.query.month || gymDay().slice(0, 7);
  const [days, hours, uniqueMembers] = await Promise.all([
    Attendance.aggregate([{ $match: { day: { $regex: `^${month}` } } }, { $group: { _id: '$day', visits: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Attendance.aggregate([
      { $match: { day: { $regex: `^${month}` } } },
      { $group: { _id: { $hour: { date: '$checkInAt', timezone: env.GYM_TIMEZONE } }, visits: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]),
    Attendance.distinct('member', { day: { $regex: `^${month}` } }),
  ]);
  const total = days.reduce((s, d) => s + d.visits, 0);
  return ok(res, {
    month, total, uniqueMembers: uniqueMembers.length, averagePerDay: days.length ? Math.round(total / days.length) : 0,
    daily: days.map((d) => ({ day: d._id, visits: d.visits })), byHour: hours.map((h) => ({ hour: h._id, visits: h.visits })),
  });
}

export async function mine(req, res) {
  const since = gymDay(addDays(new Date(), -365));
  const records = await Attendance.find({ member: req.user._id, day: { $gte: since } }).sort('-checkInAt').lean();
  const thisMonth = gymDay().slice(0, 7);
  // Current streak of consecutive days with a visit (ending today or yesterday).
  const days = new Set(records.map((r) => r.day));
  let streak = 0;
  let cursor = new Date();
  if (!days.has(gymDay(cursor))) cursor = addDays(cursor, -1);
  while (days.has(gymDay(cursor))) { streak += 1; cursor = addDays(cursor, -1); }
  return ok(res, {
    records: records.slice(0, 120),
    stats: { total: records.length, thisMonth: records.filter((r) => r.day.startsWith(thisMonth)).length, streak, checkedInToday: days.has(gymDay()) },
  });
}

export const todayStart = () => gymLocalToUtc(gymDay(), '00:00');
