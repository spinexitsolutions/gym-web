import { Types } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { NotificationModel, UserModel } from '../models';
import { renderEmail, sendEmail, type SendResult } from './email.service';
import { getSiteSettings } from './settings.service';
import { sendWhatsApp } from './whatsapp.service';

type NotificationType = 'membership' | 'payment' | 'booking' | 'class' | 'workout' | 'support' | 'system' | 'promotion';

export interface NotifyInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Unique key for this event; a second call with the same key is a no-op. */
  dedupeKey?: string;
  email?: boolean;
  whatsapp?: boolean;
  /** Transactional messages (password reset, receipts) ignore the user's email opt-out. */
  transactional?: boolean;
}

async function withRetry(fn: () => Promise<SendResult>, attempts = 2): Promise<SendResult & { attempts: number }> {
  let last: SendResult = { status: 'failed' };
  for (let i = 1; i <= attempts; i++) {
    last = await fn();
    if (last.status !== 'failed') return { ...last, attempts: i };
    await new Promise((r) => setTimeout(r, 300 * i));
  }
  return { ...last, attempts };
}

/**
 * Creates an in-app notification and delivers it by email/WhatsApp according to
 * site settings and the user's preferences. Idempotent when `dedupeKey` is provided.
 * Returns null when the notification was already sent.
 */
export async function notify(input: NotifyInput) {
  let doc;
  try {
    doc = await NotificationModel.create({
      user: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      dedupeKey: input.dedupeKey,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return null;
    throw err;
  }

  try {
    const [user, settings] = await Promise.all([UserModel.findById(input.userId).select('email phone name notificationPrefs status').lean(), getSiteSettings()]);
    if (!user) return doc;
    const deliveries: { channel: 'email' | 'whatsapp'; status: 'sent' | 'failed' | 'skipped'; error?: string; attempts: number; at: Date }[] = [];

    const wantsEmail = input.email !== false && settings.notifications.emailEnabled && (input.transactional || user.notificationPrefs?.email !== false);
    if (wantsEmail) {
      const link = input.link ? new URL(input.link, env.PUBLIC_SITE_URL).toString() : undefined;
      const r = await withRetry(() =>
        sendEmail({
          to: user.email,
          subject: input.title,
          text: `${input.body}${link ? `\n\n${link}` : ''}`,
          html: renderEmail({ brand: settings.brand.name, heading: input.title, paragraphs: [`Hi ${user.name},`, input.body], cta: link ? { label: 'Open', url: link } : undefined }),
        }),
      );
      deliveries.push({ channel: 'email', ...r, at: new Date() });
    }
    const wantsWhatsApp = input.whatsapp && settings.notifications.whatsappEnabled && user.notificationPrefs?.whatsapp && user.phone;
    if (wantsWhatsApp) {
      const r = await withRetry(() => sendWhatsApp(user.phone!, `${input.title}: ${input.body}`));
      deliveries.push({ channel: 'whatsapp', ...r, at: new Date() });
    }
    if (deliveries.length) await NotificationModel.updateOne({ _id: doc._id }, { $set: { deliveries } });
  } catch (err) {
    // Delivery failures never break the business operation; they are recorded for review.
    logger.error({ err: (err as Error).message, notification: String(doc._id) }, 'Notification delivery failed');
  }
  return doc;
}

/** Fire-and-forget wrapper for request handlers. */
export function notifyLater(input: NotifyInput) {
  void notify(input).catch((err) => logger.error({ err: (err as Error).message }, 'notify failed'));
}

export async function notifyAdmins(input: Omit<NotifyInput, 'userId'>) {
  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map((a) => notify({ ...input, userId: a._id, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${a._id}` : undefined })));
}
