import { Router } from 'express';
import { z } from 'zod';
import { BUILTIN_MODELS, PERMISSIONS } from '@apex/shared';
import { crudRouter } from '../controllers/crud.factory';
import { requireAuth, requirePermission } from '../middleware/auth';
import { publicFormLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  ContactMessageModel,
  FacilityModel,
  FaqModel,
  GalleryItemModel,
  GymClassModel,
  MediaAssetModel,
  MembershipModel,
  NewsletterSubscriberModel,
  PageModel,
  ProgramModel,
  PromotionModel,
  ReviewModel,
  TestimonialModel,
  TrainerProfileModel,
} from '../models';
import { audit } from '../services/audit.service';
import { bumpContentVersion, getContentVersion } from '../services/cms.service';
import { renderEmail, sendEmail } from '../services/email.service';
import { notifyAdmins } from '../services/notification.service';
import { paymentsStatus } from '../services/payments';
import { getPublishedTheme, getSiteSettings } from '../services/settings.service';
import { AppError } from '../utils/AppError';
import { randomToken, sha256 } from '../utils/crypto';
import { sendCsv } from '../utils/csv';
import { asyncHandler, created, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';
import * as v from '../validators/content.validators';
import { env } from '../config/env';
import { getProvider } from '../services/payments';

const r = Router();

/* --------------------------------- Public --------------------------------- */

/** Everything the public site needs to render chrome + theme in one request. */
r.get(
  '/site',
  asyncHandler(async (_req, res) => {
    const [settings, theme, navPages, promotions, models] = await Promise.all([
      getSiteSettings(),
      getPublishedTheme(),
      PageModel.find({ status: 'published', showInNav: true, isHome: false }).select('slug draft.title navOrder').sort({ navOrder: 1 }).lean(),
      activePromotions(),
      MediaAssetModel.find({ kind: 'model', 'model.status': 'approved' }).select('name url').lean(),
    ]);
    const { notifications: _n, ...publicSettings } = settings;
    let payments: Record<string, unknown> = { provider: 'disabled' };
    try {
      payments = { ...getProvider().publicConfig(), testMode: paymentsStatus().testMode };
    } catch {
      /* payments disabled */
    }
    res.setHeader('Cache-Control', 'no-cache');
    ok(res, {
      settings: publicSettings,
      theme,
      nav: navPages.map((p) => ({ slug: p.slug, title: p.draft?.title })),
      promotions,
      models: [...BUILTIN_MODELS.map((m) => ({ id: m.id, name: m.name, kind: m.kind, url: null })), ...models.map((m) => ({ id: `asset:${m._id}`, name: m.name, kind: 'gltf', url: m.url }))],
      payments,
      contentVersion: getContentVersion(),
    });
  }),
);

/** Cheap endpoint the client polls to know when to refetch published content. */
r.get('/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  ok(res, { contentVersion: getContentVersion() });
});

async function activePromotions() {
  const now = new Date();
  return PromotionModel.find({
    published: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] }],
  })
    .sort({ order: 1 })
    .limit(5)
    .lean();
}

/** Live, aggregated (non-personal) numbers for the animated statistics section. */
r.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86400000);
    const [activeMembers, trainers, programs, classesThisWeek] = await Promise.all([
      MembershipModel.distinct('user', { status: 'active', endDate: { $gt: now } }).then((x) => x.length),
      TrainerProfileModel.countDocuments({ showOnWebsite: true }),
      ProgramModel.countDocuments({ published: true }),
      GymClassModel.countDocuments({ status: 'scheduled', startsAt: { $gte: now, $lt: weekAhead } }),
    ]);
    ok(res, { activeMembers, trainers, programs, classesThisWeek });
  }),
);

const publicListQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(12), featured: z.enum(['true', 'false']).optional(), category: z.string().trim().max(40).optional() });

r.get(
  '/public/:collection',
  validate({ query: publicListQuery }),
  asyncHandler(async (req, res) => {
    const { limit, featured, category } = res.locals.query as z.infer<typeof publicListQuery>;
    switch (req.params.collection) {
      case 'programs':
        return ok(res, await ProgramModel.find({ published: true, ...(featured === 'true' ? { featured: true } : {}) }).sort({ order: 1 }).limit(limit).lean());
      case 'faqs':
        return ok(res, await FaqModel.find({ published: true, ...(category ? { category } : {}) }).sort({ order: 1 }).limit(limit).lean());
      case 'facilities':
        return ok(res, await FacilityModel.find({ published: true }).sort({ order: 1 }).limit(limit).lean());
      case 'testimonials':
        return ok(res, await TestimonialModel.find({ published: true }).sort({ order: 1 }).limit(limit).lean());
      case 'reviews':
        return ok(res, await ReviewModel.find({ status: 'approved' }).select('displayName rating title body response createdAt').sort({ createdAt: -1 }).limit(limit).lean());
      case 'promotions':
        return ok(res, await activePromotions());
      case 'gallery': {
        const cats = category ? [category] : ['transformation', 'before_after', 'facility', 'general'];
        // Member-related items require recorded consent, even if an admin marked them published.
        const items = await GalleryItemModel.find({
          published: true,
          category: { $in: cats },
          $or: [{ category: { $in: ['facility', 'general'] } }, { 'consent.given': true }],
        })
          .select('-consent.recordedBy -consent.reference')
          .sort({ order: 1 })
          .limit(limit)
          .lean();
        return ok(res, items);
      }
      default:
        throw AppError.notFound('Collection');
    }
  }),
);

r.get(
  '/public/programs/:slug',
  asyncHandler(async (req, res) => {
    const p = await ProgramModel.findOne({ slug: req.params.slug, published: true }).lean();
    if (!p) throw AppError.notFound('Program');
    ok(res, p);
  }),
);

r.post(
  '/contact',
  publicFormLimiter,
  validate({ body: v.contactSchema }),
  asyncHandler(async (req, res) => {
    const { website: _hp, ...data } = req.body;
    const msg = await ContactMessageModel.create(data);
    await notifyAdmins({ type: 'system', title: 'New contact message', body: `${data.name}: ${data.subject || data.message.slice(0, 80)}`, link: '/admin/messages', dedupeKey: `contact:${msg._id}`, email: true });
    created(res, { received: true });
  }),
);

r.post(
  '/newsletter',
  publicFormLimiter,
  validate({ body: v.newsletterSchema }),
  asyncHandler(async (req, res) => {
    const token = randomToken(24);
    await NewsletterSubscriberModel.findOneAndUpdate(
      { email: req.body.email },
      { $set: { status: 'subscribed', consentAt: new Date(), source: req.body.source, unsubscribeTokenHash: sha256(token) } },
      { upsert: true },
    );
    const settings = await getSiteSettings();
    const url = `${env.PUBLIC_SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}&email=${encodeURIComponent(req.body.email)}`;
    await sendEmail({
      to: req.body.email,
      subject: `You're subscribed to ${settings.brand.name}`,
      text: `Thanks for subscribing. Unsubscribe any time: ${url}`,
      html: renderEmail({ brand: settings.brand.name, heading: "You're on the list", paragraphs: ['Thanks for subscribing to our training notes.', `Unsubscribe any time: ${url}`] }),
    });
    // Same response whether new or existing (no email enumeration).
    created(res, { subscribed: true });
  }),
);

r.post(
  '/newsletter/unsubscribe',
  publicFormLimiter,
  validate({ body: z.object({ email: z.string().email(), token: z.string().min(10).max(200) }) }),
  asyncHandler(async (req, res) => {
    await NewsletterSubscriberModel.updateOne({ email: req.body.email.toLowerCase(), unsubscribeTokenHash: sha256(req.body.token) }, { $set: { status: 'unsubscribed' } });
    ok(res, { unsubscribed: true });
  }),
);

/* ---------------------------------- Admin --------------------------------- */

const admin = Router();
admin.use(requireAuth);

admin.use('/programs', crudRouter({ name: 'Program', model: ProgramModel, schema: v.programSchema, permission: 'cms:write', searchFields: ['title', 'slug'], defaultSort: { order: 1, createdAt: -1 } }));
admin.use('/faqs', crudRouter({ name: 'Faq', model: FaqModel, schema: v.faqSchema, permission: 'cms:write', searchFields: ['question', 'category'], defaultSort: { order: 1 } }));
admin.use('/facilities', crudRouter({ name: 'Facility', model: FacilityModel, schema: v.facilitySchema, permission: 'cms:write', searchFields: ['name'], defaultSort: { order: 1 } }));
admin.use('/testimonials', crudRouter({ name: 'Testimonial', model: TestimonialModel, schema: v.testimonialSchema, permission: 'cms:write', searchFields: ['name', 'quote'], defaultSort: { order: 1 } }));
admin.use('/promotions', crudRouter({ name: 'Promotion', model: PromotionModel, schema: v.promotionSchema, permission: 'cms:write', searchFields: ['title'], defaultSort: { order: 1, createdAt: -1 } }));
admin.use(
  '/gallery',
  crudRouter({
    name: 'GalleryItem',
    model: GalleryItemModel,
    schema: v.gallerySchema,
    permission: 'cms:write',
    searchFields: ['title', 'memberDisplayName'],
    defaultSort: { order: 1, createdAt: -1 },
    beforeSave: (req, data, existing) => {
      const consent = data.consent as { given: boolean; reference: string };
      const prev = (existing?.consent ?? {}) as { given?: boolean; recordedAt?: Date; recordedBy?: unknown };
      return {
        ...data,
        consent: consent.given
          ? { given: true, reference: consent.reference, recordedAt: prev.given ? prev.recordedAt : new Date(), recordedBy: prev.given ? prev.recordedBy : req.user!.id }
          : { given: false, reference: consent.reference },
      };
    },
  }),
);

admin.get(
  '/messages',
  requirePermission('cms:write'),
  validate({ query: listQuery.extend({ status: z.enum(['new', 'read', 'archived']).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, status } = res.locals.query;
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([ContactMessageModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ContactMessageModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);
admin.patch(
  '/messages/:id',
  requirePermission('cms:write'),
  validate({ body: z.object({ status: z.enum(['new', 'read', 'archived']) }) }),
  asyncHandler(async (req, res) => {
    const m = await ContactMessageModel.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
    if (!m) throw AppError.notFound('Message');
    ok(res, m);
  }),
);

admin.get(
  '/subscribers',
  requirePermission('cms:write'),
  validate({ query: listQuery.extend({ format: z.enum(['json', 'csv']).default('json') }) }),
  asyncHandler(async (req, res) => {
    const { page, limit, format } = res.locals.query;
    if (format === 'csv') {
      const all = await NewsletterSubscriberModel.find({ status: 'subscribed' }).sort({ createdAt: -1 }).lean();
      await audit(req, { action: 'subscribers.export', entity: 'NewsletterSubscriber', summary: `Exported ${all.length} subscribers` });
      return sendCsv(res, 'subscribers.csv', ['email', 'source', 'consentAt'], all.map((s) => [s.email, s.source, s.consentAt]));
    }
    const [items, total] = await Promise.all([NewsletterSubscriberModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), NewsletterSubscriberModel.countDocuments()]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

admin.get(
  '/reviews',
  requirePermission('cms:write'),
  validate({ query: listQuery.extend({ status: z.enum(['pending', 'approved', 'rejected']).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, status } = res.locals.query;
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([ReviewModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ReviewModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);
admin.patch(
  '/reviews/:id',
  requirePermission('cms:write'),
  validate({ body: z.object({ status: z.enum(['pending', 'approved', 'rejected']), response: z.string().trim().max(1000).optional() }) }),
  asyncHandler(async (req, res) => {
    const rv = await ReviewModel.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, response: req.body.response, moderatedBy: req.user!.id } }, { new: true });
    if (!rv) throw AppError.notFound('Review');
    bumpContentVersion();
    await audit(req, { action: 'review.moderate', entity: 'Review', entityId: rv._id, summary: `Review ${req.body.status}` });
    ok(res, rv);
  }),
);

admin.get('/permissions', (_req, res) => ok(res, PERMISSIONS));

r.use('/admin', admin);
export default r;
