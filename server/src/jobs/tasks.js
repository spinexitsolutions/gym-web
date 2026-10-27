import { Membership, Booking, ClassSchedule, User } from '../models/index.js';
import { notify } from '../services/notification.service.js';
import { sendEmail, appUrl, escapeHtml } from '../services/email.service.js';
import { gymDay, addDays } from '../utils/dates.js';

export async function activateScheduledMemberships() {
  const now = new Date();
  const due = await Membership.find({ status: 'pending', startDate: { $lte: now }, endDate: { $gt: now } }).select('_id user');
  if (!due.length) return { activated: 0 };
  await Membership.updateMany({ _id: { $in: due.map((m) => m._id) } }, { status: 'active' });
  return { activated: due.length };
}

export async function expireMemberships() {
  const now = new Date();
  const expired = await Membership.find({ status: 'active', endDate: { $lt: now } }).populate('plan', 'name').select('user plan');
  if (!expired.length) return { expired: 0 };
  await Membership.updateMany({ _id: { $in: expired.map((m) => m._id) } }, { status: 'expired' });
  // Only tell members who have no follow-on membership already starting.
  for (const m of expired) {
     
    const renewed = await Membership.exists({ user: m.user, status: { $in: ['active', 'pending'] }, endDate: { $gt: now } });
    if (!renewed) {
       
      await notify(m.user, { type: 'membership', email: true, title: 'Your membership has expired', body: `Your ${m.plan?.name || ''} membership has ended. Renew any time to keep training.`, link: '/dashboard/membership' });
    }
  }
  return { expired: expired.length };
}

const REMINDERS = [{ key: 'expiry-7d', days: 7 }, { key: 'expiry-1d', days: 1 }];

// Each reminder is sent at most once per membership (tracked in remindersSent).
export async function sendExpiryReminders() {
  const now = new Date();
  let sent = 0;
  for (const r of REMINDERS) {
     
    const due = await Membership.find({ status: 'active', endDate: { $gt: now, $lte: addDays(now, r.days) }, remindersSent: { $ne: r.key } }).populate('plan', 'name').populate('user', 'name email status');
    for (const m of due) {
       
      const renewed = await Membership.exists({ user: m.user?._id, status: 'pending', startDate: { $gte: m.endDate } });
      // Claim the reminder first so a crash or a second instance can never send it twice.
       
      const claimed = await Membership.updateOne({ _id: m._id, remindersSent: { $ne: r.key } }, { $addToSet: { remindersSent: r.key } });
      if (!claimed.modifiedCount || renewed || m.user?.status !== 'active') continue;
      const when = r.days === 1 ? 'tomorrow' : `on ${gymDay(m.endDate)}`;
       
      await notify(m.user._id, { type: 'membership', title: `Your membership ends ${when}`, body: `Renew your ${m.plan?.name || ''} membership to keep your access, bookings and progress uninterrupted.`, link: '/dashboard/membership' });
       
      await sendEmail({
        to: m.user.email, subject: `Renewal reminder: your membership ends ${when}`, heading: `Hi ${escapeHtml(m.user.name.split(' ')[0])}, time to renew`,
        body: `<p>Your <strong>${escapeHtml(m.plan?.name || '')}</strong> membership ends ${when}. Renew now — your new period starts the day the current one ends, so you won't lose a single day.</p>`,
        cta: { label: 'Renew membership', href: appUrl('/dashboard/membership') },
      }).catch((e) => console.error('Reminder email failed:', e.message));
      sent += 1;
    }
  }
  return { sent };
}

export async function completePastSessions() {
  const now = new Date();
  const classes = await ClassSchedule.updateMany({ status: 'scheduled', endAt: { $lt: now } }, { status: 'completed' });
  // Class attendance is assumed; PT sessions are left for the trainer to mark completed / no-show.
  const bookings = await Booking.updateMany({ type: 'class', status: 'booked', endAt: { $lt: now } }, { status: 'completed' });
  const waitlists = await Booking.updateMany({ status: 'waitlisted', endAt: { $lt: now } }, { status: 'cancelled', cancelReason: 'Class ended before a spot opened' });
  return { classes: classes.modifiedCount, bookings: bookings.modifiedCount, waitlistsClosed: waitlists.modifiedCount };
}

export async function purgeUnverified() {
  // Unverified members with no purchases are removed after 30 days to limit stored personal data.
  const cutoff = addDays(new Date(), -30);
  const stale = await User.find({ role: 'member', emailVerified: false, createdAt: { $lt: cutoff } }).select('_id').lean();
  const ids = [];
  for (const u of stale) {
     
    if (!(await Membership.exists({ user: u._id }))) ids.push(u._id);
  }
  if (ids.length) await User.updateMany({ _id: { $in: ids } }, { status: 'deleted', name: 'Removed (unverified)', $unset: { phone: 1 } });
  return { removed: ids.length };
}
