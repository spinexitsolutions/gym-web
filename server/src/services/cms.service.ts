import type { Request } from 'express';
import { DEFAULT_THEME, SECTION_META, createSection, themeTokensSchema, validateSections, type DraftSection, type ThemeTokens } from '@apex/shared';
import { withTransaction } from '../config/db';
import { PageModel, PageVersionModel } from '../models';
import { AppError } from '../utils/AppError';
import { audit } from './audit.service';
import { getThemeDoc } from './settings.service';

/** Monotonic content version; the public client uses it to refetch after a publish. */
let contentVersion = Date.now();
export const getContentVersion = () => contentVersion;
export const bumpContentVersion = () => {
  contentVersion = Date.now();
  return contentVersion;
};

/* ---------------------------------- Pages --------------------------------- */

export async function savePageDraft(req: Request, pageId: string, input: { title?: string; slug?: string; seo?: Record<string, unknown>; featuredImage?: string; sections?: DraftSection[]; showInNav?: boolean; navOrder?: number }) {
  const page = await PageModel.findById(pageId);
  if (!page) throw AppError.notFound('Page');
  if (input.slug && input.slug !== page.slug) {
    if (page.system) throw AppError.badRequest('The slug of a system page cannot be changed');
    page.slug = input.slug;
  }
  if (input.title !== undefined) page.draft!.title = input.title;
  if (input.seo) page.draft!.seo = { ...(page.draft!.seo ?? {}), ...input.seo } as never;
  if (input.featuredImage !== undefined) page.draft!.featuredImage = input.featuredImage;
  if (input.sections) {
    const ids = new Set<string>();
    for (const s of input.sections) {
      if (ids.has(s.id)) throw AppError.validation('Duplicate section id', [{ path: `sections.${s.id}`, message: 'Duplicate section id' }]);
      ids.add(s.id);
    }
    page.draft!.sections = input.sections;
    page.markModified('draft.sections');
  }
  if (input.showInNav !== undefined) page.showInNav = input.showInNav;
  if (input.navOrder !== undefined) page.navOrder = input.navOrder;
  page.hasUnpublishedChanges = true;
  page.draftUpdatedAt = new Date();
  page.updatedBy = req.user!.id as never;
  await page.save();
  return page;
}

/**
 * Publishes the draft. The full draft is validated against the section schemas first;
 * if anything is invalid nothing changes and the currently published version stays live.
 */
export async function publishPage(req: Request, pageId: string, note?: string) {
  const page = await PageModel.findById(pageId);
  if (!page) throw AppError.notFound('Page');
  const result = validateSections(page.draft!.sections as unknown[]);
  if (!result.ok) {
    throw AppError.validation('Fix the highlighted sections before publishing. The live page has not changed.', result.errors);
  }
  const version = await withTransaction(async (session) => {
    const nextVersion = (page.publishedVersionNumber ?? 0) + 1;
    const [v] = await PageVersionModel.create(
      [
        {
          page: page._id,
          version: nextVersion,
          slug: page.slug,
          title: page.draft!.title,
          seo: page.draft!.seo,
          featuredImage: page.draft!.featuredImage,
          sections: result.sections,
          publishedBy: req.user!.id,
          note,
        },
      ],
      { session },
    );
    await PageModel.updateOne(
      { _id: page._id },
      { $set: { publishedVersion: v._id, publishedVersionNumber: nextVersion, publishedAt: new Date(), status: 'published', hasUnpublishedChanges: false, 'draft.sections': result.sections } },
      { session },
    );
    return v;
  });
  bumpContentVersion();
  await audit(req, { action: 'page.publish', entity: 'Page', entityId: page._id, summary: `Published "${page.draft!.title}" v${version.version}` });
  return version;
}

export async function unpublishPage(req: Request, pageId: string) {
  const page = await PageModel.findById(pageId);
  if (!page) throw AppError.notFound('Page');
  if (page.isHome) throw AppError.badRequest('The home page cannot be unpublished');
  page.status = 'unpublished';
  await page.save();
  bumpContentVersion();
  await audit(req, { action: 'page.unpublish', entity: 'Page', entityId: page._id, summary: `Unpublished "${page.draft!.title}"` });
  return page;
}

/** Restores an older version into the draft (it still needs publishing). */
export async function restoreVersionToDraft(req: Request, pageId: string, versionId: string) {
  const v = await PageVersionModel.findOne({ _id: versionId, page: pageId }).lean();
  if (!v) throw AppError.notFound('Version');
  return savePageDraft(req, pageId, { title: v.title, seo: v.seo as Record<string, unknown>, featuredImage: v.featuredImage, sections: v.sections as DraftSection[] });
}

export async function getPublishedPage(slug: string) {
  const page = await PageModel.findOne({ slug, status: 'published' }).select('publishedVersion slug isHome').lean();
  if (!page?.publishedVersion) return null;
  const v = await PageVersionModel.findById(page.publishedVersion).lean();
  if (!v) return null;
  return {
    id: String(page._id),
    slug: page.slug,
    isHome: page.isHome,
    title: v.title,
    seo: v.seo,
    featuredImage: v.featuredImage,
    version: v.version,
    publishedAt: v.createdAt,
    sections: (v.sections as { enabled?: boolean }[]).filter((s) => s.enabled !== false),
  };
}

export function defaultHomeSections(): DraftSection[] {
  const order = ['hero', 'stats', 'about', 'programs', 'equipment3d', 'trainers', 'pricing', 'schedule', 'transformations', 'testimonials', 'beforeAfter', 'facilities', 'bmi', 'promo', 'blog', 'faq', 'location', 'trialForm', 'contact', 'newsletter'] as const;
  return order.map((t) => createSection(t, SECTION_META[t].defaults));
}

/* ---------------------------------- Theme --------------------------------- */

export async function saveThemeDraft(req: Request, tokens: ThemeTokens, presetId?: string) {
  const doc = await getThemeDoc();
  doc.draft = tokens;
  if (presetId) doc.presetId = presetId;
  doc.draftUpdatedAt = new Date();
  doc.markModified('draft');
  await doc.save();
  await audit(req, { action: 'theme.save_draft', entity: 'Theme', entityId: doc._id, summary: 'Saved theme draft' });
  return doc;
}

export async function publishTheme(req: Request) {
  const doc = await getThemeDoc();
  const parsed = themeTokensSchema.safeParse(doc.draft);
  if (!parsed.success) {
    throw AppError.validation('The theme draft is invalid; the live theme has not changed.', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const history = [{ tokens: doc.published, publishedAt: doc.publishedAt ?? new Date(), publishedBy: doc.publishedBy }, ...(doc.history ?? [])].slice(0, 10);
  doc.published = parsed.data;
  doc.publishedAt = new Date();
  doc.publishedBy = req.user!.id as never;
  doc.history = history as never;
  doc.markModified('published');
  await doc.save();
  bumpContentVersion();
  await audit(req, { action: 'theme.publish', entity: 'Theme', entityId: doc._id, summary: 'Published theme' });
  return doc;
}

export async function resetThemeDraft(req: Request) {
  return saveThemeDraft(req, DEFAULT_THEME, 'titanium-lime');
}
