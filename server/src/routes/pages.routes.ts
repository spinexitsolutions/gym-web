import { Router } from 'express';
import { z } from 'zod';
import { createSection, newSectionId, pageDraftUpdateSchema, pageInputSchema, validateSections, type DraftSection } from '@apex/shared';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { PageModel, PageVersionModel } from '../models';
import { audit } from '../services/audit.service';
import * as cms from '../services/cms.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';

const r = Router();

/* Public: published content only. */
r.get(
  '/public/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug === 'home' ? (await PageModel.findOne({ isHome: true }).select('slug').lean())?.slug ?? 'home' : req.params.slug;
    const page = await cms.getPublishedPage(slug);
    if (!page) throw AppError.notFound('Page');
    res.setHeader('Cache-Control', 'no-cache');
    ok(res, page);
  }),
);

/* Admin */
const admin = Router();
admin.use(requireAuth, requirePermission('cms:write'));

const pageView = (p: InstanceType<typeof PageModel> | Record<string, unknown>) => {
  const x = p as unknown as { _id: unknown; slug: string; isHome: boolean; system: boolean; status: string; draft: { title: string; seo: unknown; featuredImage: string; sections: DraftSection[] }; showInNav: boolean; navOrder: number; publishedVersionNumber: number; publishedAt?: Date; hasUnpublishedChanges: boolean; draftUpdatedAt?: Date; updatedAt?: Date };
  return {
    id: String(x._id),
    slug: x.slug,
    isHome: x.isHome,
    system: x.system,
    status: x.status,
    title: x.draft.title,
    seo: x.draft.seo,
    featuredImage: x.draft.featuredImage,
    sections: x.draft.sections,
    showInNav: x.showInNav,
    navOrder: x.navOrder,
    publishedVersion: x.publishedVersionNumber,
    publishedAt: x.publishedAt ?? null,
    hasUnpublishedChanges: x.hasUnpublishedChanges,
    draftUpdatedAt: x.draftUpdatedAt ?? null,
    updatedAt: x.updatedAt,
  };
};

admin.get(
  '/',
  asyncHandler(async (_req, res) => {
    const pages = await PageModel.find().sort({ isHome: -1, navOrder: 1, createdAt: 1 }).lean();
    ok(
      res,
      pages.map((p) => {
        const { sections, ...rest } = pageView(p);
        return { ...rest, sectionCount: sections.length };
      }),
    );
  }),
);

admin.post(
  '/',
  validate({ body: pageInputSchema.extend({ template: z.enum(['blank', 'landing']).default('blank') }) }),
  asyncHandler(async (req, res) => {
    const { title, slug, seo, featuredImage, showInNav, navOrder, template } = req.body;
    const sections: DraftSection[] =
      template === 'landing'
        ? [createSection('hero', { headline: title, mediaType: 'image' }), createSection('richText', { heading: 'Overview' }), createSection('cta')]
        : [createSection('richText', { heading: title })];
    const page = await PageModel.create({ slug, status: 'draft', showInNav, navOrder, draft: { title, seo, featuredImage, sections }, draftUpdatedAt: new Date(), updatedBy: req.user!.id });
    await audit(req, { action: 'page.create', entity: 'Page', entityId: page._id, summary: `Created page "${title}"` });
    created(res, pageView(page));
  }),
);

admin.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const page = await PageModel.findById(req.params.id).lean();
    if (!page) throw AppError.notFound('Page');
    const validation = validateSections(page.draft!.sections as unknown[]);
    ok(res, { ...pageView(page), validation: validation.ok ? { ok: true, errors: [] } : validation });
  }),
);

/** Saves the draft (sections may be incomplete). Never affects the live page. */
admin.put(
  '/:id/draft',
  validate({ body: pageDraftUpdateSchema }),
  asyncHandler(async (req, res) => {
    const page = await cms.savePageDraft(req, req.params.id, req.body);
    const validation = validateSections(page.draft!.sections as unknown[]);
    ok(res, { ...pageView(page), validation: validation.ok ? { ok: true, errors: [] } : validation });
  }),
);

admin.post(
  '/:id/publish',
  validate({ body: z.object({ note: z.string().trim().max(200).optional() }) }),
  asyncHandler(async (req, res) => {
    const version = await cms.publishPage(req, req.params.id, req.body.note);
    ok(res, { version: version.version, publishedAt: version.createdAt, contentVersion: cms.getContentVersion() });
  }),
);

admin.post('/:id/unpublish', asyncHandler(async (req, res) => ok(res, pageView(await cms.unpublishPage(req, req.params.id)))));

admin.post(
  '/:id/duplicate',
  validate({ body: z.object({ slug: pageInputSchema.shape.slug, title: z.string().trim().min(1).max(120) }) }),
  asyncHandler(async (req, res) => {
    const src = await PageModel.findById(req.params.id).lean();
    if (!src) throw AppError.notFound('Page');
    const sections = (src.draft!.sections as DraftSection[]).map((s) => ({ ...s, id: newSectionId() }));
    const page = await PageModel.create({ slug: req.body.slug, status: 'draft', draft: { ...src.draft, title: req.body.title, sections }, draftUpdatedAt: new Date(), updatedBy: req.user!.id });
    await audit(req, { action: 'page.duplicate', entity: 'Page', entityId: page._id, summary: `Duplicated "${src.draft!.title}"` });
    created(res, pageView(page));
  }),
);

admin.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const page = await PageModel.findById(req.params.id);
    if (!page) throw AppError.notFound('Page');
    if (page.system || page.isHome) throw AppError.badRequest('System pages cannot be deleted');
    await PageVersionModel.deleteMany({ page: page._id });
    await page.deleteOne();
    cms.bumpContentVersion();
    await audit(req, { action: 'page.delete', entity: 'Page', entityId: page._id, summary: `Deleted page "${page.draft!.title}"` });
    ok(res, { deleted: true });
  }),
);

admin.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const versions = await PageVersionModel.find({ page: req.params.id }).select('version title note publishedBy createdAt').populate('publishedBy', 'name').sort({ version: -1 }).limit(50).lean();
    ok(res, versions);
  }),
);

admin.post('/:id/versions/:versionId/restore', asyncHandler(async (req, res) => ok(res, pageView(await cms.restoreVersionToDraft(req, req.params.id, req.params.versionId)))));

r.use('/', admin);
export default r;
