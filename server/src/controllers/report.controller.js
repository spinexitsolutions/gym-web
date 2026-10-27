import { z } from 'zod';
import env from '../config/env.js';
import {
  User, Membership, Payment, Attendance, Booking, AuditLog, ContactInquiry, SupportTicket,
} from '../models/index.js';
import { ok } from '../utils/apiResponse.js';
import { gymDay, gymLocalToUtc, addDays } from '../utils/dates.js';
import { objectId } from '../validators/common.js';

const tz = () => env.GYM_TIMEZONE;
const monthStart = (ym) => gymLocalToUtc(`${ym}-01`, '00:00');
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export async function overview(_req, res) {
  const now = new Date();
  const today = gymDay();
  const ym = today.slice(0, 7);
  const thisMonth = monthStart(ym);
  const thisYear = gymLocalToUtc(`${ym.slice(0, 4)}-01-01`, '00:00');
  const last30 = addDays(now, -30);

  const [
    totalMembers, newMembers, activeIds, everIds, revenueMonth, revenueYear, pending, refundRequests,
    attendanceToday, attendanceMonth, upcomingRenewals, openInquiries, openTickets, trainerStats, recent,
  ] = await Promise.all([
    User.countDocuments({ role: 'member', status: { $ne: 'deleted' } }),
    User.countDocuments({ role: 'member', createdAt: { $gte: last30 } }),
    Membership.distinct('user', { status: 'active', startDate: { $lte: now }, endDate: { $gte: now } }),
    Membership.distinct('user', {}),
    Payment.aggregate([{ $match: { status: 'paid', paidAt: { $gte: thisMonth } } }, { $group: { _id: null, t: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'paid', paidAt: { $gte: thisYear } } }, { $group: { _id: null, t: { $sum: '$amountPaise' } } }]),
    Payment.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, t: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]),
    Payment.countDocuments({ status: 'refund_requested' }),
    Attendance.countDocuments({ day: today }),
    Attendance.countDocuments({ day: { $regex: `^${ym}` } }),
    Membership.find({ status: 'active', endDate: { $gte: now, $lte: addDays(now, 14) } }).populate('user', 'name email phone').populate('plan', 'name').sort('endDate').limit(10).lean(),
    ContactInquiry.countDocuments({ status: 'new' }),
    SupportTicket.countDocuments({ status: 'open' }),
    Booking.aggregate([
      { $match: { type: 'personal_training', startAt: { $gte: thisMonth } } },
      { $group: { _id: '$trainer', booked: { $sum: { $cond: [{ $in: ['$status', ['booked', 'completed', 'no_show']] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } },
      { $lookup: { from: 'trainers', localField: '_id', foreignField: '_id', as: 't', pipeline: [{ $project: { name: 1, rating: 1 } }] } },
      { $set: { trainer: { $first: '$t' } } }, { $project: { t: 0 } }, { $sort: { booked: -1 } }, { $limit: 10 },
    ]),
    AuditLog.find({ action: { $not: /^member\.view/ } }).populate('actor', 'name').sort('-createdAt').limit(10).lean(),
  ]);

  const activeSet = new Set(activeIds.map(String));
  const expired = everIds.filter((id) => !activeSet.has(String(id))).length;
  return ok(res, {
    members: { total: totalMembers, active: activeIds.length, expired, neverPurchased: Math.max(0, totalMembers - everIds.length), newLast30Days: newMembers },
    revenue: { monthPaise: revenueMonth[0]?.t || 0, monthPayments: revenueMonth[0]?.n || 0, yearPaise: revenueYear[0]?.t || 0 },
    payments: { pendingPaise: pending[0]?.t || 0, pendingCount: pending[0]?.n || 0, refundRequests },
    attendance: { today: attendanceToday, month: attendanceMonth },
    inbox: { newInquiries: openInquiries, openTickets },
    upcomingRenewals,
    trainerPerformance: trainerStats,
    recentActivity: recent,
    generatedAt: now,
  });
}

export const revenueQuery = z.object({ months: z.coerce.number().int().min(1).max(36).default(12), plan: objectId.optional() });

// Monthly revenue (paid minus refunded), plus revenue by plan for the same window.
export async function revenue(req, res) {
  const end = gymDay().slice(0, 7);
  const start = shiftMonth(end, -(req.query.months - 1));
  const match = { status: { $in: ['paid', 'refunded'] }, paidAt: { $gte: monthStart(start) } };
  if (req.query.plan) match.plan = req.query.plan;
  const monthExpr = { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: tz() } };
  const [byMonth, byPlan] = await Promise.all([
    Payment.aggregate([{ $match: match }, { $group: {
      _id: monthExpr,
      gross: { $sum: '$amountPaise' },
      refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, { $ifNull: ['$refund.amountPaise', '$amountPaise'] }, 0] } },
      count: { $sum: 1 },
    } }]),
    Payment.aggregate([{ $match: match }, { $group: { _id: '$plan', gross: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      { $lookup: { from: 'membershipplans', localField: '_id', foreignField: '_id', as: 'p', pipeline: [{ $project: { name: 1 } }] } },
      { $project: { plan: { $ifNull: [{ $first: '$p.name' }, 'Other'] }, gross: 1, count: 1 } }, { $sort: { gross: -1 } }]),
  ]);
  const map = Object.fromEntries(byMonth.map((m) => [m._id, m]));
  const series = [];
  for (let m = start; m <= end; m = shiftMonth(m, 1)) {
    const row = map[m] || { gross: 0, refunded: 0, count: 0 };
    series.push({ month: m, grossPaise: row.gross, refundedPaise: row.refunded, netPaise: row.gross - row.refunded, payments: row.count });
  }
  return ok(res, { series, byPlan });
}

export async function growth(req, res) {
  const months = Math.min(36, Number(req.query.months) || 12);
  const end = gymDay().slice(0, 7);
  const start = shiftMonth(end, -(months - 1));
  const monthExpr = (f) => ({ $dateToString: { format: '%Y-%m', date: f, timezone: tz() } });
  const [signups, starts] = await Promise.all([
    User.aggregate([{ $match: { role: 'member', createdAt: { $gte: monthStart(start) } } }, { $group: { _id: monthExpr('$createdAt'), n: { $sum: 1 } } }]),
    Membership.aggregate([{ $match: { startDate: { $gte: monthStart(start) } } }, { $group: { _id: monthExpr('$startDate'), n: { $sum: 1 }, renewals: { $sum: { $cond: [{ $ifNull: ['$renewalOf', false] }, 1, 0] } } } }]),
  ]);
  const s = Object.fromEntries(signups.map((x) => [x._id, x.n]));
  const m = Object.fromEntries(starts.map((x) => [x._id, x]));
  // Active members at each month end (memberships overlapping the month's last moment).
  const series = [];
  for (let ym = start; ym <= end; ym = shiftMonth(ym, 1)) {
    const monthEnd = monthStart(shiftMonth(ym, 1));
    const at = ym === end ? new Date() : monthEnd;
     
    const active = (await Membership.distinct('user', { status: { $in: ['active', 'expired'] }, startDate: { $lte: at }, endDate: { $gte: at } })).length;
    series.push({ month: ym, signups: s[ym] || 0, newMemberships: (m[ym]?.n || 0) - (m[ym]?.renewals || 0), renewals: m[ym]?.renewals || 0, activeMembers: active });
  }
  return ok(res, series);
}

export const dailyQuery = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), plan: objectId.optional() });

export async function revenueDaily(req, res) {
  const match = { status: 'paid', paidAt: { $gte: gymLocalToUtc(req.query.from, '00:00'), $lt: gymLocalToUtc(gymDay(addDays(new Date(`${req.query.to}T12:00:00Z`), 1)), '00:00') } };
  if (req.query.plan) match.plan = req.query.plan;
  const rows = await Payment.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz() } }, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  return ok(res, rows.map((r) => ({ day: r._id, totalPaise: r.total, payments: r.count })));
}
