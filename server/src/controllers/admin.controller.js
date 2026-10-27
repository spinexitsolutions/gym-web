import { z } from 'zod';
import mongoose from 'mongoose';
import {
  User, Trainer, Membership, Booking, ClassSchedule, ContactInquiry, AuditLog, Review, Announcement, Challenge,
  NewsletterSubscriber, ErrorLog, SystemState, MembershipPlan, WorkoutProgram, Testimonial, Gallery, Faq, BlogPost, Coupon,
} from '../models/index.js';
import { resource } from './resource.factory.js';
import * as v from '../validators/admin.validator.js';
import { audit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';
import { sendEmail, appUrl, escapeHtml, smtpConfigured } from '../services/email.service.js';
import { uploadBuffer, deleteAsset } from '../services/upload.service.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';
import { razorpayConfigured, activeProvider } from '../services/gateway.service.js';
import { pushEnabled } from '../services/notification.service.js';
import env from '../config/env.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex } from '../utils/pagination.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { email, objectId } from '../validators/common.js';
import { sendCsv } from '../utils/csv.js';

// ---------- Content resources ----------
export const plans = resource({
  name: 'plan', model: MembershipPlan, schema: v.planSchema, searchFields: ['name', 'tagline'], slugFrom: 'name',
  filters: { status: z.enum(['draft', 'published']).optional(), isActive: z.enum(['true', 'false']).optional() },
  sortable: ['order', 'name', 'createdAt'], defaultSort: 'order',
  beforeDelete: async (doc) => {
    if (await Membership.exists({ plan: doc._id })) throw ApiError.conflict('Members have used this plan. Deactivate or unpublish it instead of deleting.');
  },
});

export const trainers = resource({
  name: 'trainer', model: Trainer, schema: v.trainerSchema, searchFields: ['name', 'title', 'specializations'], slugFrom: 'name',
  filters: { isActive: z.enum(['true', 'false']).optional() }, sortable: ['order', 'name', 'experienceYears'], defaultSort: 'order',
  populate: { path: 'user', select: 'name email role' },
  beforeWrite: async (data) => {
    if (data.user) {
      const u = await User.findById(data.user);
      if (!u || u.role !== 'trainer') throw ApiError.badRequest('Linked account must have the trainer role', [{ field: 'user', message: 'Choose a trainer account' }]);
    }
  },
  beforeDelete: async (doc) => {
    if (await Booking.exists({ trainer: doc._id }) || await ClassSchedule.exists({ trainer: doc._id })) {
      throw ApiError.conflict('This trainer has bookings or classes. Mark them inactive instead of deleting.');
    }
  },
});

export const programs = resource({
  name: 'program', model: WorkoutProgram, schema: v.programSchema, searchFields: ['title', 'summary'], slugFrom: 'title',
  filters: { category: z.string().max(30).optional(), isActive: z.enum(['true', 'false']).optional() },
  sortable: ['order', 'title', 'createdAt'], defaultSort: 'order',
});

export const testimonials = resource({
  name: 'testimonial', model: Testimonial, schema: v.testimonialSchema, searchFields: ['name', 'quote', 'headline'],
  filters: { isPublished: z.enum(['true', 'false']).optional() }, sortable: ['order', 'createdAt'], defaultSort: 'order',
});

export const gallery = resource({
  name: 'gallery item', model: Gallery, schema: v.gallerySchema, updateSchema: v.galleryBase.partial(), searchFields: ['title', 'caption'],
  filters: { category: z.string().max(20).optional(), isPublished: z.enum(['true', 'false']).optional() }, sortable: ['order', 'createdAt'], defaultSort: 'order',
});

export const faqs = resource({
  name: 'faq', model: Faq, schema: v.faqSchema, searchFields: ['question', 'answer'], sortable: ['order', 'createdAt'], defaultSort: 'order',
});

export const events = resource({
  name: 'event', model: Challenge, schema: v.eventSchema, updateSchema: v.eventBase.partial(), searchFields: ['title'], slugFrom: 'title',
  filters: { kind: z.enum(['event', 'challenge']).optional() }, sortable: ['startDate', 'createdAt'], defaultSort: '-startDate',
});

export const announcements = resource({
  name: 'announcement', model: Announcement, schema: v.announcementSchema, searchFields: ['title', 'body'],
  filters: { status: z.enum(['draft', 'published']).optional(), audience: z.string().max(10).optional() },
  beforeWrite: async (data, req, existing) => { if (!existing) data.createdBy = req.user._id; },
});

export const blog = resource({
  name: 'post', model: BlogPost, schema: v.blogSchema, searchFields: ['title', 'excerpt', 'tags'], slugFrom: 'title',
  filters: { status: z.enum(['draft', 'published']).optional() }, sortable: ['createdAt', 'publishedAt', 'title'],
  populate: { path: 'author', select: 'name' },
  beforeWrite: async (data, req, existing) => {
    if (!existing) data.author = req.user._id;
    if (data.status === 'published' && !existing?.publishedAt) data.publishedAt = new Date();
  },
});

export const coupons = resource({
  name: 'coupon', model: Coupon, schema: v.couponSchema, updateSchema: v.couponBase.partial(), searchFields: ['code', 'description'],
  filters: { isActive: z.enum(['true', 'false']).optional(), kind: z.enum(['promo', 'referral']).optional() },
  populate: [{ path: 'applicablePlans', select: 'name' }, { path: 'owner', select: 'name email' }],
});

// ---------- Media ----------
const FOLDERS = ['branding', 'hero', 'gallery', 'trainers', 'programs', 'blog', 'facilities', 'testimonials', 'events', 'misc'];
export const mediaQuery = z.object({ folder: z.enum(FOLDERS).default('misc') });

export async function uploadMedia(req, res) {
  const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const result = await uploadBuffer(req.file.buffer, { folder: req.query.folder, resourceType });
  await audit(req, { action: 'media.upload', entity: 'Media', entityId: result.publicId, summary: `${resourceType} ${req.file.size} bytes` });
  return created(res, { ...result, resourceType });
}

export async function deleteMedia(req, res) {
  await deleteAsset(req.body.publicId, req.body.resourceType);
  await audit(req, { action: 'media.delete', entity: 'Media', entityId: req.body.publicId });
  return ok(res, null, { message: 'Deleted' });
}

// ---------- Inquiries ----------
export const inquiryListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['new', 'in_progress', 'resolved', 'spam']).optional(), q: z.string().trim().max(100).optional(), sort: z.string().max(20).optional(),
});

export async function listInquiries(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); filter.$or = [{ name: rx }, { email: rx }, { message: rx }, { phone: rx }]; }
  const { items, meta } = await paginate(ContactInquiry, filter, parsePagination(req.query), { populate: [{ path: 'assignedTo', select: 'name' }, { path: 'notes.by', select: 'name' }] });
  const counts = Object.fromEntries((await ContactInquiry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((c) => [c._id, c.n]));
  return ok(res, items, { meta: { ...meta, counts } });
}

export async function updateInquiry(req, res) {
  const inq = await ContactInquiry.findById(req.params.id);
  if (!inq) throw ApiError.notFound('Inquiry not found');
  const { status, assignedTo, note } = req.body;
  if (status) inq.status = status;
  if (assignedTo !== undefined) inq.assignedTo = assignedTo || undefined;
  if (note) inq.notes.push({ by: req.user._id, text: note });
  await inq.save();
  await audit(req, { action: 'inquiry.update', entity: 'ContactInquiry', entityId: inq._id, changes: { status, assignedTo } });
  return ok(res, await inq.populate([{ path: 'assignedTo', select: 'name' }, { path: 'notes.by', select: 'name' }]), { message: 'Inquiry updated' });
}

// ---------- Staff ----------
const STAFF_ROLES = ['owner', 'admin', 'staff', 'trainer'];

export async function listStaff(_req, res) {
  const staff = await User.find({ role: { $in: STAFF_ROLES }, status: { $ne: 'deleted' } }).sort('role name').lean();
  const trainerLinks = await Trainer.find({ user: { $in: staff.map((s) => s._id) } }).select('user name slug').lean();
  const byUser = Object.fromEntries(trainerLinks.map((t) => [String(t.user), t]));
  return ok(res, staff.map((s) => ({
    id: s._id, name: s.name, email: s.email, phone: s.phone, role: s.role, status: s.status, lastLoginAt: s.lastLoginAt, trainer: byUser[String(s._id)] || null,
  })));
}

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80), email, role: z.enum(['admin', 'staff', 'trainer']),
  trainerId: objectId.optional(), // link to an existing public trainer profile
});

const canManageRole = (actor, role) => actor.role === 'owner' || (actor.role === 'admin' && ['staff', 'trainer'].includes(role));

export async function createStaff(req, res) {
  const { name, email: addr, role, trainerId } = req.body;
  if (!canManageRole(req.user, role)) throw ApiError.forbidden('Only the owner can create admin accounts');
  let user = await User.findOne({ email: addr });
  if (user && !['member'].includes(user.role)) throw ApiError.conflict('This email already belongs to a staff account');
  const token = randomToken(32);
  if (user) {
    user.role = role; // promote existing member account
  } else {
    user = new User({ name, email: addr, password: `${randomToken(24)}Aa1`, role, emailVerified: true });
    user.passwordResetTokenHash = sha256(token);
    user.passwordResetExpires = new Date(Date.now() + 7 * 864e5);
  }
  await user.save();
  if (role === 'trainer' && trainerId) await Trainer.updateOne({ _id: trainerId }, { user: user._id });
  if (user.passwordResetTokenHash) {
    await sendEmail({
      to: addr, subject: 'You have been invited to the team', heading: `Welcome, ${escapeHtml(name.split(' ')[0])}`,
      body: `<p>You've been given <strong>${role}</strong> access to the gym dashboard. Set your password to get started (link valid 7 days).</p>`,
      cta: { label: 'Set password', href: appUrl(`/reset-password?token=${token}`) },
    });
  }
  await audit(req, { action: 'staff.create', entity: 'User', entityId: user._id, summary: `${addr} as ${role}` });
  return created(res, user.toSafeJSON(), 'Team member invited');
}

export const staffUpdateSchema = z.object({ role: z.enum(['admin', 'staff', 'trainer', 'member']).optional(), status: z.enum(['active', 'suspended']).optional() });

export async function updateStaff(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || !STAFF_ROLES.includes(user.role)) throw ApiError.notFound('Team member not found');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own role or status');
  if (user.role === 'owner') throw ApiError.forbidden('The owner account cannot be changed here');
  if (!canManageRole(req.user, user.role) || (req.body.role && req.body.role !== 'member' && !canManageRole(req.user, req.body.role))) throw ApiError.forbidden();
  const before = { role: user.role, status: user.status };
  Object.assign(user, req.body);
  await user.save();
  if (req.body.status === 'suspended' || req.body.role) {
    const { revokeAllSessions } = await import('../services/token.service.js');
    await revokeAllSessions(user._id);
  }
  await audit(req, { action: 'staff.update', entity: 'User', entityId: user._id, changes: { before, after: req.body } });
  return ok(res, user.toSafeJSON(), { message: 'Team member updated' });
}

// ---------- Reviews moderation ----------
export async function recomputeTrainerRating(trainerId) {
  const [agg] = await Review.aggregate([
    { $match: { targetType: 'trainer', target: new mongoose.Types.ObjectId(String(trainerId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Trainer.updateOne({ _id: trainerId }, { rating: { average: agg ? Math.round(agg.avg * 10) / 10 : 0, count: agg?.n || 0 } });
}

export async function listReviews(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const { items, meta } = await paginate(Review, filter, parsePagination(req.query), { populate: [{ path: 'user', select: 'name email' }, { path: 'target', select: 'name title' }] });
  return ok(res, items, { meta });
}

export async function moderateReview(req, res) {
  const review = await Review.findByIdAndUpdate(req.params.id, { status: req.body.status, moderatedBy: req.user._id }, { new: true });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.targetType === 'trainer') await recomputeTrainerRating(review.target);
  await audit(req, { action: `review.${req.body.status}`, entity: 'Review', entityId: review._id });
  return ok(res, review, { message: `Review ${req.body.status}` });
}

// ---------- Announcement delivery ----------
export async function deliverAnnouncement(req, res) {
  const a = await Announcement.findById(req.params.id);
  if (!a) throw ApiError.notFound('Announcement not found');
  if (a.status !== 'published') throw ApiError.badRequest('Publish the announcement before sending it');
  if (a.deliveredAt) throw ApiError.conflict('This announcement was already sent');
  const roleFilter = a.audience === 'staff' ? { role: { $in: ['owner', 'admin', 'staff', 'trainer'] } } : { role: 'member' };
  const users = await User.find({ ...roleFilter, status: 'active' }).select('_id').lean();
  await notify(users.map((u) => u._id), { type: 'announcement', title: a.title, body: a.body, link: a.link?.href || '/dashboard', email: a.sendEmail });
  a.deliveredAt = new Date();
  await a.save();
  await audit(req, { action: 'announcement.deliver', entity: 'Announcement', entityId: a._id, summary: `${users.length} recipients` });
  return ok(res, a, { message: `Sent to ${users.length} people` });
}

// ---------- Challenge scores (manual metric) ----------
export const scoreSchema = z.object({ userId: objectId, score: z.coerce.number().min(0).max(1e6) });

export async function setScore(req, res) {
  const ch = await Challenge.findById(req.params.id);
  if (!ch) throw ApiError.notFound('Event not found');
  const p = ch.participants.find((x) => String(x.user) === req.body.userId);
  if (!p) throw ApiError.badRequest('This member has not joined the challenge');
  p.score = req.body.score;
  await ch.save();
  await audit(req, { action: 'challenge.score', entity: 'Challenge', entityId: ch._id, changes: req.body });
  return ok(res, ch, { message: 'Score saved' });
}

// ---------- Audit log, newsletter, system ----------
export const auditQuery = z.object({
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
  entity: z.string().max(40).optional(), action: z.string().max(60).optional(), actor: objectId.optional(),
});

export async function listAudit(req, res) {
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = new RegExp(`^${escapeRegex(req.query.action)}`);
  if (req.query.actor) filter.actor = req.query.actor;
  const { items, meta } = await paginate(AuditLog, filter, parsePagination(req.query, { defaultLimit: 50 }), { populate: { path: 'actor', select: 'name email role' } });
  return ok(res, items, { meta });
}

export async function listSubscribers(req, res) {
  if (req.path.endsWith('.csv')) {
    const rows = await NewsletterSubscriber.find({ status: 'subscribed' }).sort('-createdAt').lean();
    return sendCsv(res, 'newsletter-subscribers.csv', rows, [{ label: 'Email', value: 'email' }, { label: 'Subscribed', value: 'createdAt' }]);
  }
  const { items, meta } = await paginate(NewsletterSubscriber, {}, parsePagination(req.query));
  return ok(res, items, { meta });
}

export async function systemStatus(_req, res) {
  const [jobs, errors, dbStats] = await Promise.all([
    SystemState.find({ key: /^job:/ }).lean(),
    ErrorLog.find().sort({ $natural: -1 }).limit(50).lean(),
    mongoose.connection.db.stats().catch(() => null),
  ]);
  return ok(res, {
    integrations: {
      database: mongoose.connection.readyState === 1,
      cloudinary: cloudinaryEnabled,
      smtp: smtpConfigured(),
      razorpay: razorpayConfigured(),
      paymentProvider: activeProvider(),
      webhookSecret: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
      push: pushEnabled,
      assistant: Boolean(env.ANTHROPIC_API_KEY),
    },
    environment: env.NODE_ENV,
    timezone: env.GYM_TIMEZONE,
    uptimeSeconds: Math.round(process.uptime()),
    database: dbStats ? { collections: dbStats.collections, dataSizeMB: Math.round(dbStats.dataSize / 1048576), storageSizeMB: Math.round(dbStats.storageSize / 1048576) } : null,
    jobs: jobs.map((j) => ({ name: j.key.replace('job:', ''), lastRunAt: j.lastRunAt, lastResult: j.lastResult, lastError: j.lastError })),
    errors,
  });
}
