import { AttendanceModel, AuditLogModel, BookingModel, GymClassModel, MembershipModel, PaymentModel, UserModel } from '../models';
import { addDays } from '../utils/dates';
import { getSiteSettings } from './settings.service';

export type Interval = 'day' | 'week' | 'month';
const fmt: Record<Interval, string> = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' };

export async function overview() {
  const now = new Date();
  const tz = (await getSiteSettings()).business.timezone;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [
    totalMembers,
    activeMemberIds,
    expiredMemberships,
    expiring7,
    expiring14,
    newRegistrations30,
    revenue30,
    revenueMonth,
    refunds30,
    pendingPayments,
    failedPayments7,
    upcomingClasses,
    attendanceToday,
    recentActivity,
    recentSignups,
    pendingTrials,
  ] = await Promise.all([
    UserModel.countDocuments({ role: 'member' }),
    MembershipModel.distinct('user', { status: 'active', endDate: { $gt: now } }),
    MembershipModel.countDocuments({ status: 'expired' }),
    MembershipModel.countDocuments({ status: 'active', endDate: { $gt: now, $lte: addDays(now, 7) } }),
    MembershipModel.countDocuments({ status: 'active', endDate: { $gt: now, $lte: addDays(now, 14) } }),
    UserModel.countDocuments({ role: 'member', createdAt: { $gte: addDays(now, -30) } }),
    sumCaptured(addDays(now, -30), now),
    sumCaptured(startOfMonth, now),
    PaymentModel.aggregate<{ total: number }>([{ $match: { 'refund.requestedAt': { $gte: addDays(now, -30) }, 'refund.status': { $in: ['processed', 'processing'] } } }, { $group: { _id: null, total: { $sum: '$refund.amountMinor' } } }]),
    PaymentModel.countDocuments({ status: 'pending' }),
    PaymentModel.countDocuments({ status: 'failed', updatedAt: { $gte: addDays(now, -7) } }),
    GymClassModel.find({ status: 'scheduled', startsAt: { $gte: now, $lt: addDays(now, 7) } }).populate('trainer', 'name').sort({ startsAt: 1 }).limit(8).lean(),
    AttendanceModel.countDocuments({ checkInAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    AuditLogModel.find().sort({ createdAt: -1 }).limit(10).lean(),
    UserModel.find({ role: 'member' }).select('name email createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    BookingModel.countDocuments({ type: 'trial', status: 'pending' }),
  ]);
  return {
    totalMembers,
    activeMembers: activeMemberIds.length,
    expiredMemberships,
    expiringIn7Days: expiring7,
    expiringIn14Days: expiring14,
    newRegistrations30d: newRegistrations30,
    revenue30dMinor: revenue30,
    revenueThisMonthMinor: revenueMonth,
    refunds30dMinor: refunds30[0]?.total ?? 0,
    pendingPayments,
    failedPayments7d: failedPayments7,
    attendanceToday,
    pendingTrials,
    upcomingClasses,
    recentActivity,
    recentSignups,
    timezone: tz,
  };
}

async function sumCaptured(from: Date, to: Date) {
  const r = await PaymentModel.aggregate<{ total: number }>([
    { $match: { status: { $in: ['captured', 'partially_refunded', 'refunded'] }, capturedAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  return r[0]?.total ?? 0;
}

export async function registrations(from: Date, to: Date, interval: Interval) {
  const tz = (await getSiteSettings()).business.timezone;
  return UserModel.aggregate<{ _id: string; count: number }>([
    { $match: { role: 'member', createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: fmt[interval], date: '$createdAt', timezone: tz } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).then((rows) => rows.map((r) => ({ period: r._id, count: r.count })));
}

export async function revenue(from: Date, to: Date, interval: Interval) {
  const tz = (await getSiteSettings()).business.timezone;
  const rows = await PaymentModel.aggregate<{ _id: string; gross: number; refunds: number; count: number; online: number; offline: number }>([
    { $match: { status: { $in: ['captured', 'partially_refunded', 'refunded'] }, capturedAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: fmt[interval], date: '$capturedAt', timezone: tz } },
        gross: { $sum: '$amountMinor' },
        refunds: { $sum: { $ifNull: ['$refund.amountMinor', 0] } },
        count: { $sum: 1 },
        online: { $sum: { $cond: [{ $eq: ['$provider', 'offline'] }, 0, '$amountMinor'] } },
        offline: { $sum: { $cond: [{ $eq: ['$provider', 'offline'] }, '$amountMinor', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ period: r._id, grossMinor: r.gross, refundsMinor: r.refunds, netMinor: r.gross - r.refunds, onlineMinor: r.online, offlineMinor: r.offline, payments: r.count }));
}

export async function planPerformance(from: Date, to: Date) {
  const [sales, active] = await Promise.all([
    PaymentModel.aggregate<{ _id: unknown; name: string; sales: number; revenue: number }>([
      { $match: { status: { $in: ['captured', 'partially_refunded', 'refunded'] }, capturedAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$plan', name: { $last: '$planName' }, sales: { $sum: 1 }, revenue: { $sum: { $subtract: ['$amountMinor', { $ifNull: ['$refund.amountMinor', 0] }] } } } },
      { $sort: { revenue: -1 } },
    ]),
    MembershipModel.aggregate<{ _id: unknown; active: number }>([{ $match: { status: 'active' } }, { $group: { _id: '$plan', active: { $sum: 1 } } }]),
  ]);
  return sales.map((s) => ({ planId: String(s._id), planName: s.name, sales: s.sales, revenueMinor: s.revenue, activeMemberships: active.find((a) => String(a._id) === String(s._id))?.active ?? 0 }));
}

export async function membershipBreakdown() {
  const rows = await MembershipModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return rows.map((r) => ({ status: r._id, count: r.count }));
}

export async function bookingSummary(from: Date, to: Date, interval: Interval) {
  const tz = (await getSiteSettings()).business.timezone;
  const [byStatus, attendance, classes] = await Promise.all([
    BookingModel.aggregate<{ _id: { type: string; status: string }; count: number }>([{ $match: { startsAt: { $gte: from, $lte: to } } }, { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } }]),
    AttendanceModel.aggregate<{ _id: string; count: number }>([
      { $match: { checkInAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: fmt[interval], date: '$checkInAt', timezone: tz } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    GymClassModel.aggregate<{ _id: null; sessions: number; capacity: number; booked: number }>([
      { $match: { startsAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, sessions: { $sum: 1 }, capacity: { $sum: '$capacity' }, booked: { $sum: '$bookedCount' } } },
    ]),
  ]);
  const c = classes[0];
  return {
    byStatus: byStatus.map((b) => ({ type: b._id.type, status: b._id.status, count: b.count })),
    attendance: attendance.map((a) => ({ period: a._id, count: a.count })),
    classes: { sessions: c?.sessions ?? 0, fillRate: c && c.capacity ? Math.round((c.booked / c.capacity) * 1000) / 10 : 0 },
  };
}
