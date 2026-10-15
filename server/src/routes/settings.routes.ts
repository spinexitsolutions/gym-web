import { Router } from 'express';
import { z } from 'zod';
import { PERMISSION_LABELS, siteSettingsSchema } from '@apex/shared';
import { env } from '../config/env';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuditLogModel, JobStateModel } from '../models';
import { audit } from '../services/audit.service';
import { bumpContentVersion } from '../services/cms.service';
import { emailConfigured } from '../services/email.service';
import { paymentsStatus } from '../services/payments';
import { getSiteSettings, saveSiteSettings } from '../services/settings.service';
import { whatsappConfigured } from '../services/whatsapp.service';
import { shallowDiff } from '../utils/diff';
import { asyncHandler, ok } from '../utils/http';
import { listQuery, pageMeta } from '../utils/pagination';

const r = Router();
r.use(requireAuth);

r.get('/', requirePermission('settings:write'), asyncHandler(async (_req, res) => ok(res, await getSiteSettings())));

r.put(
  '/',
  requirePermission('settings:write'),
  validate({ body: siteSettingsSchema }),
  asyncHandler(async (req, res) => {
    const before = await getSiteSettings();
    await saveSiteSettings(req.body, req.user!.id);
    bumpContentVersion();
    await audit(req, { action: 'settings.update', entity: 'WebsiteSettings', summary: 'Updated site settings', changes: shallowDiff(before as unknown as Record<string, unknown>, req.body) });
    ok(res, await getSiteSettings());
  }),
);

/** Integration status for the admin (never returns secret values). */
r.get(
  '/system-status',
  requirePermission('settings:write'),
  asyncHandler(async (_req, res) => {
    const jobs = await JobStateModel.find().select('name lastStartedAt lastFinishedAt lastStatus lastError lastResult').lean();
    ok(res, {
      environment: env.NODE_ENV,
      payments: paymentsStatus(),
      email: { configured: emailConfigured(), from: env.EMAIL_FROM.replace(/<.*>/, '').trim() },
      whatsapp: { provider: env.WHATSAPP_PROVIDER, configured: whatsappConfigured() },
      storage: { driver: env.STORAGE_DRIVER, maxImageMb: env.MAX_IMAGE_MB, maxModelMb: env.MAX_MODEL_MB },
      emailVerificationRequired: env.REQUIRE_EMAIL_VERIFICATION,
      jobsEnabled: env.JOBS_ENABLED,
      jobs,
      permissions: PERMISSION_LABELS,
    });
  }),
);

r.get(
  '/audit-logs',
  requirePermission('audit:read'),
  validate({ query: listQuery.extend({ entity: z.string().trim().max(40).optional(), action: z.string().trim().max(60).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, entity, action } = res.locals.query;
    const filter: Record<string, unknown> = {};
    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    const [items, total] = await Promise.all([AuditLogModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLogModel.countDocuments(filter)]);
    ok(res, items, pageMeta(page, limit, total));
  }),
);

export default r;
