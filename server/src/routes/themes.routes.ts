import { Router } from 'express';
import { z } from 'zod';
import { THEME_PRESETS, themeTokensSchema } from '@apex/shared';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as cms from '../services/cms.service';
import { getPublishedTheme, getThemeDoc } from '../services/settings.service';
import { asyncHandler, ok } from '../utils/http';

const r = Router();

r.get('/published', asyncHandler(async (_req, res) => ok(res, await getPublishedTheme())));

r.use(requireAuth, requirePermission('cms:write'));

const view = (doc: Awaited<ReturnType<typeof getThemeDoc>>) => ({
  draft: doc.draft,
  published: doc.published,
  presetId: doc.presetId,
  publishedAt: doc.publishedAt,
  draftUpdatedAt: doc.draftUpdatedAt,
  hasUnpublishedChanges: JSON.stringify(doc.draft) !== JSON.stringify(doc.published),
  history: (doc.history ?? []).map((h, i) => ({ index: i, publishedAt: h.publishedAt })),
  presets: Object.entries(THEME_PRESETS).map(([id, p]) => ({ id, label: p.label, tokens: p.tokens })),
});

r.get('/', asyncHandler(async (_req, res) => ok(res, view(await getThemeDoc()))));

r.put(
  '/draft',
  validate({ body: z.object({ tokens: themeTokensSchema, presetId: z.string().max(40).optional() }) }),
  asyncHandler(async (req, res) => ok(res, view(await cms.saveThemeDraft(req, req.body.tokens, req.body.presetId)))),
);

r.post('/publish', asyncHandler(async (req, res) => ok(res, view(await cms.publishTheme(req)))));
r.post('/reset-draft', asyncHandler(async (req, res) => ok(res, view(await cms.resetThemeDraft(req)))));

/** Loads a previously published theme into the draft for review before republishing. */
r.post(
  '/history/:index/restore',
  asyncHandler(async (req, res) => {
    const doc = await getThemeDoc();
    const entry = doc.history?.[Number(req.params.index)];
    const parsed = themeTokensSchema.safeParse(entry?.tokens);
    if (!parsed.success) return ok(res, view(doc));
    ok(res, view(await cms.saveThemeDraft(req, parsed.data)));
  }),
);

export default r;
