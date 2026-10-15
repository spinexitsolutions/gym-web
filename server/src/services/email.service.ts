import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest } from '../config/env';
import { logger } from '../config/logger';

let transporter: Transporter | null = null;

export const emailConfigured = () => Boolean(env.SMTP_HOST);

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Test hook: captured emails in NODE_ENV=test. */
export const sentEmails: EmailMessage[] = [];

export type SendResult = { status: 'sent' | 'skipped' | 'failed'; error?: string };

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (isTest) {
    sentEmails.push(msg);
    return { status: 'sent' };
  }
  const t = getTransporter();
  if (!t) {
    logger.info({ to: maskEmail(msg.to), subject: msg.subject }, 'Email not sent: SMTP is not configured');
    return { status: 'skipped', error: 'SMTP not configured' };
  }
  try {
    await t.sendMail({ from: env.EMAIL_FROM, ...msg });
    return { status: 'sent' };
  } catch (err) {
    logger.error({ err: (err as Error).message, to: maskEmail(msg.to) }, 'Email send failed');
    return { status: 'failed', error: (err as Error).message.slice(0, 300) };
  }
}

export function maskEmail(email: string) {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d ?? ''}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Minimal branded HTML wrapper. All dynamic values are escaped. */
export function renderEmail(opts: { brand: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string } }) {
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#c9cdd2">${esc(p)}</p>`).join('');
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.url)}" style="background:#c6ff3d;color:#08090b;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${esc(opts.cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#08090b;font-family:Inter,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#121417;border:1px solid #24282e;border-radius:16px"><tr><td style="padding:32px"><div style="font-weight:700;letter-spacing:.2em;color:#c6ff3d;font-size:12px;text-transform:uppercase">${esc(opts.brand)}</div><h1 style="color:#f4f5f6;font-size:22px;margin:16px 0">${esc(opts.heading)}</h1>${body}${cta}</td></tr></table></td></tr></table></body></html>`;
}
