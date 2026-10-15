import { BookingModel, MembershipModel, TrainerNoteModel } from '../models';
import { syncMembershipStatuses } from '../services/membership.service';
import { notify } from '../services/notification.service';
import { expireStaleOrders, notifyFailedPaymentsDigest } from '../services/payment.service';
import { getSiteSettings } from '../services/settings.service';
import { addDays } from '../utils/dates';

/** Expiry reminders at the configured day offsets. Dedupe keys make re-runs safe. */
export async function sendExpiryReminders(now = new Date()) {
  const settings = await getSiteSettings();
  let sent = 0;
  for (const days of settings.notifications.expiryReminderDays) {
    const windowStart = addDays(now, days - 1);
    const windowEnd = addDays(now, days);
    const expiring = await MembershipModel.find({ status: 'active', endDate: { $gt: windowStart, $lte: windowEnd } }).lean();
    for (const m of expiring) {
      // Skip if the member already has a renewal queued.
      const queued = await MembershipModel.exists({ user: m.user, status: 'upcoming', startDate: { $gte: m.endDate } });
      if (queued) continue;
      const n = await notify({
        userId: m.user,
        type: 'membership',
        title: days === 1 ? 'Your membership ends tomorrow' : `Your membership ends in ${days} days`,
        body: `Your ${m.planSnapshot?.name} membership ends on ${new Date(m.endDate).toDateString()}. Renew now to keep training without interruption.`,
        link: '/member/membership',
        dedupeKey: `expiry:${m._id}:${days}`,
        whatsapp: true,
      });
      if (n) sent++;
    }
  }
  // Expired notice (once).
  const justExpired = await MembershipModel.find({ status: 'expired', endDate: { $gte: addDays(now, -2), $lte: now } }).lean();
  for (const m of justExpired) {
    const renewed = await MembershipModel.exists({ user: m.user, status: { $in: ['active', 'upcoming'] } });
    if (renewed) continue;
    const n = await notify({ userId: m.user, type: 'membership', title: 'Your membership has expired', body: `Your ${m.planSnapshot?.name} membership has ended. We'd love to have you back.`, link: '/memberships', dedupeKey: `expired:${m._id}` });
    if (n) sent++;
  }
  return { sent };
}

export async function sendClassReminders(now = new Date()) {
  const settings = await getSiteSettings();
  const horizon = new Date(now.getTime() + settings.notifications.classReminderHours * 3600000);
  const bookings = await BookingModel.find({ status: 'confirmed', active: true, user: { $ne: null }, startsAt: { $gt: now, $lte: horizon } }).populate('gymClass', 'title location').lean();
  let sent = 0;
  for (const b of bookings) {
    const title = b.type === 'class' ? (b.gymClass as unknown as { title?: string })?.title ?? 'Class' : 'Personal training';
    const n = await notify({ userId: b.user!, type: 'class', title: `Reminder: ${title}`, body: `Starts ${b.startsAt.toLocaleString('en-IN', { timeZone: settings.business.timezone })}.`, link: '/member/bookings', dedupeKey: `reminder:${b._id}`, whatsapp: true });
    if (n) sent++;
  }
  return { sent };
}

export async function sendTrainerFollowUps(now = new Date()) {
  const due = await TrainerNoteModel.find({ done: false, followUpAt: { $lte: now, $gte: addDays(now, -1) } }).populate('member', 'name').lean();
  let sent = 0;
  for (const n of due) {
    const r = await notify({ userId: n.trainer, type: 'system', title: 'Follow-up due', body: `Follow up with ${(n.member as unknown as { name?: string })?.name ?? 'a member'}: ${n.body.slice(0, 120)}`, link: '/trainer/notes', dedupeKey: `followup:${n._id}`, email: false });
    if (r) sent++;
  }
  return { sent };
}

/** Marks confirmed bookings that ended >12h ago without attendance as no-shows. */
export async function closePastBookings(now = new Date()) {
  const r = await BookingModel.updateMany({ status: { $in: ['confirmed', 'waitlisted'] }, endsAt: { $lt: new Date(now.getTime() - 12 * 3600000) } }, [
    { $set: { status: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 'cancelled', 'no_show'] }, active: false } },
  ]);
  return { closed: r.modifiedCount };
}

export const tasks = {
  membershipStatus: () => syncMembershipStatuses(),
  expiryReminders: () => sendExpiryReminders(),
  classReminders: () => sendClassReminders(),
  trainerFollowUps: () => sendTrainerFollowUps(),
  expireOrders: () => expireStaleOrders(),
  closePastBookings: () => closePastBookings(),
  failedPaymentsDigest: () => notifyFailedPaymentsDigest(),
};
