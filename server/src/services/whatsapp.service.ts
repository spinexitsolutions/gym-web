import { env, isTest } from '../config/env';
import { logger } from '../config/logger';
import type { SendResult } from './email.service';

export const whatsappConfigured = () =>
  (env.WHATSAPP_PROVIDER === 'meta' && Boolean(env.WHATSAPP_META_TOKEN && env.WHATSAPP_META_PHONE_NUMBER_ID)) ||
  (env.WHATSAPP_PROVIDER === 'twilio' && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM));

/** E.164 normalisation for Indian numbers without a country code. */
export function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * Sends a WhatsApp message through an approved Business provider.
 * Meta Cloud API requires pre-approved templates for business-initiated messages; we send a
 * template named `templateName` with the body text as its single parameter. See docs/integrations.md.
 */
export async function sendWhatsApp(to: string, text: string, templateName = 'apex_notification'): Promise<SendResult> {
  if (isTest) return { status: 'skipped', error: 'test' };
  if (!whatsappConfigured()) return { status: 'skipped', error: 'WhatsApp provider not configured' };
  const phone = normalisePhone(to);
  if (!phone) return { status: 'skipped', error: 'Invalid phone number' };
  try {
    if (env.WHATSAPP_PROVIDER === 'meta') {
      const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.WHATSAPP_META_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace('+', ''),
          type: 'template',
          template: { name: templateName, language: { code: env.WHATSAPP_META_TEMPLATE_LANG }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 1000) }] }] },
        }),
      });
      if (!res.ok) throw new Error(`Meta API ${res.status}`);
    } else {
      const body = new URLSearchParams({ From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${phone}`, Body: text.slice(0, 1500) });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`Twilio API ${res.status}`);
    }
    return { status: 'sent' };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'WhatsApp send failed');
    return { status: 'failed', error: (err as Error).message.slice(0, 300) };
  }
}
