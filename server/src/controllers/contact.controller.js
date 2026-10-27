import { ContactInquiry, NewsletterSubscriber } from '../models/index.js';
import { sendEmail, emailTemplates } from '../services/email.service.js';
import { created, ok } from '../utils/apiResponse.js';
import { sha256 } from '../utils/crypto.js';

const MIN_FILL_MS = 3000; // humans take longer than 3 s to fill a contact form

function looksLikeBot(body) {
  if (body.website) return true;
  if (body.startedAt && Date.now() - body.startedAt < MIN_FILL_MS) return true;
  const links = (body.message?.match(/https?:\/\//g) || []).length;
  return links > 3;
}

export async function submitInquiry(req, res) {
  const { website, startedAt, ...data } = req.body;
  if (looksLikeBot({ website, startedAt, message: data.message })) {
    // Respond as if it succeeded so bots do not learn the rule; nothing is stored.
    return created(res, null, 'Thanks! We will be in touch shortly.');
  }
  const ipHash = req.ip ? sha256(req.ip) : undefined;
  const recent = ipHash
    ? await ContactInquiry.countDocuments({ ipHash, createdAt: { $gt: new Date(Date.now() - 3600_000) } })
    : 0;
  const inquiry = await ContactInquiry.create({ ...data, ipHash, status: recent >= 5 ? 'spam' : 'new' });
  if (inquiry.status === 'new') {
    sendEmail(emailTemplates.inquiryReceived(inquiry)).catch((e) => console.error('Inquiry email failed:', e.message));
  }
  return created(res, { id: inquiry._id }, 'Thanks! We will be in touch shortly.');
}

export async function subscribeNewsletter(req, res) {
  if (req.body.website) return ok(res, null, { message: 'Subscribed' });
  await NewsletterSubscriber.findOneAndUpdate(
    { email: req.body.email },
    { $set: { status: 'subscribed' }, $setOnInsert: { source: 'website' } },
    { upsert: true },
  );
  return ok(res, null, { message: 'You are subscribed. Welcome to the Aurum Letter.' });
}
