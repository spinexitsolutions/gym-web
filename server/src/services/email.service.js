import nodemailer from 'nodemailer';
import env, { clientOrigins, isTest } from '../config/env.js';

let transporter;
const smtpConfigured = () => Boolean(env.SMTP_HOST);

function getTransporter() {
  if (!transporter && smtpConfigured()) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export const appUrl = (path = '') => `${clientOrigins[0]}${path}`;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ heading, body, cta }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#C9A54C;color:#0B0B0C;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#888">If the button does not work, copy this link: ${cta.href}</p>`
    : '';
  return `<div style="background:#0B0B0C;padding:32px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:auto;background:#141416;border:1px solid #2a2a2e;border-radius:10px;padding:32px;color:#e9e6df">
      <p style="letter-spacing:4px;color:#C9A54C;font-size:12px;margin:0 0 16px">AURUM FITNESS CLUB</p>
      <h1 style="font-size:22px;margin:0 0 16px;color:#fff">${escapeHtml(heading)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#cfcac0">${body}</div>${button}
    </div></div>`;
}

export async function sendEmail({ to, subject, heading, body, cta, text, attachments }) {
  const html = layout({ heading: heading || subject, body, cta });
  const message = { from: env.MAIL_FROM, to, subject, html, text: text || `${heading || subject}\n\n${cta?.href || ''}`, attachments };
  const t = getTransporter();
  if (!t) {
    // Development fallback: show where the email would go. Links are printed so flows can be tested locally.
    if (!isTest) console.log(`[email:dev] to=${to} subject="${subject}"${cta ? ` link=${cta.href}` : ''}`);
    return { delivered: false };
  }
  await t.sendMail(message);
  return { delivered: true };
}

export const emailTemplates = {
  verifyEmail: (user, token) => ({
    to: user.email,
    subject: 'Verify your email address',
    heading: `Welcome, ${user.name.split(' ')[0]}`,
    body: '<p>Confirm your email address to activate your member account. This link expires in 24 hours.</p>',
    cta: { label: 'Verify email', href: appUrl(`/verify-email?token=${token}`) },
  }),
  resetPassword: (user, token) => ({
    to: user.email,
    subject: 'Reset your password',
    heading: 'Password reset requested',
    body: '<p>Use the button below to choose a new password. The link expires in 30 minutes. If you did not request this, you can ignore this email.</p>',
    cta: { label: 'Reset password', href: appUrl(`/reset-password?token=${token}`) },
  }),
  passwordChanged: (user) => ({
    to: user.email,
    subject: 'Your password was changed',
    heading: 'Password changed',
    body: '<p>Your password was just changed and all other sessions were signed out. If this was not you, reset your password immediately and contact the front desk.</p>',
  }),
  inquiryReceived: (inquiry) => ({
    to: inquiry.email,
    subject: 'We received your message',
    heading: `Thanks, ${escapeHtml(inquiry.name.split(' ')[0])}`,
    body: '<p>Our team will get back to you within one business day.</p>',
  }),
};

export { escapeHtml, smtpConfigured };
