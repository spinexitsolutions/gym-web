import webpush from 'web-push';
import env from '../config/env.js';
import { Notification, MemberProfile, PushSubscription, User } from '../models/index.js';
import { sendEmail, appUrl, escapeHtml } from './email.service.js';

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

async function sendPush(userId, payload) {
  if (!pushEnabled) return;
  const subs = await PushSubscription.find({ user: userId }).lean();
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600 });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id }); // expired
    }
  }));
}

/**
 * Notify one or more users. In-app always; email when `email` is true and the user allows email;
 * push when the user has subscribed. Never throws — notification failures must not break the main action.
 */
export async function notify(userIds, { type = 'system', title, body, link, email = false, emailSubject, emailCta }) {
  const ids = [...new Set([].concat(userIds).filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map((user) => ({ user, type, title, body, link })));
  } catch (err) {
    console.error('Notification insert failed:', err.message);
  }
  for (const id of ids) {
    sendPush(id, { title, body, link }).catch(() => {});
  }
  if (!email) return;
  try {
    const [users, prefs] = await Promise.all([
      User.find({ _id: { $in: ids }, status: 'active' }).select('name email').lean(),
      MemberProfile.find({ user: { $in: ids } }).select('user notificationPrefs').lean(),
    ]);
    const optedOut = new Set(prefs.filter((p) => p.notificationPrefs?.email === false).map((p) => String(p.user)));
    for (const u of users) {
      if (optedOut.has(String(u._id))) continue;
      sendEmail({
        to: u.email,
        subject: emailSubject || title,
        heading: title,
        body: `<p>${escapeHtml(body || '')}</p>`,
        cta: emailCta || (link ? { label: 'Open dashboard', href: appUrl(link) } : undefined),
      }).catch((e) => console.error('Notification email failed:', e.message));
    }
  } catch (err) {
    console.error('Notification email lookup failed:', err.message);
  }
}

// Staff with any of these roles receive operational alerts (new inquiry, support ticket, refund request).
export async function notifyStaff(payload, roles = ['owner', 'admin', 'staff']) {
  const staff = await User.find({ role: { $in: roles }, status: 'active' }).select('_id').lean();
  return notify(staff.map((s) => s._id), payload);
}
