import { Router, type Request } from 'express';
import type { Model } from 'mongoose';
import type { ZodTypeAny } from 'zod';
import type { Permission } from '@apex/shared';
import { requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../services/audit.service';
import { bumpContentVersion } from '../services/cms.service';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';
import { shallowDiff } from '../utils/diff';

export interface CrudConfig {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  schema: ZodTypeAny;
  permission: Permission;
  searchFields: string[];
  defaultSort: Record<string, 1 | -1>;
  /** Transform validated input before saving (e.g. stamp consent metadata). */
  beforeSave?: (req: Request, data: Record<string, unknown>, existing?: Record<string, unknown>) => Record<string, unknown>;
}

/** Admin CRUD routes for a CMS collection: GET /, GET /:id, POST /, PUT /:id, DELETE /:id. */
export function crudRouter(cfg: CrudConfig) {
  const r = Router();
  r.use(requirePermission(cfg.permission));

  r.get(
    '/',
    validate({ query: listQuery }),
    asyncHandler(async (req, res) => {
      const { page, limit, q } = res.locals.query as { page: number; limit: number; q?: string };
      const filter = q ? { $or: cfg.searchFields.map((f) => ({ [f]: { $regex: escapeRegex(q), $options: 'i' } })) } : {};
      const [items, total] = await Promise.all([
        cfg.model.find(filter).sort(cfg.defaultSort).skip((page - 1) * limit).limit(limit).lean(),
        cfg.model.countDocuments(filter),
      ]);
      ok(res, items, pageMeta(page, limit, total));
    }),
  );

  r.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await cfg.model.findById(req.params.id).lean();
      if (!item) throw AppError.notFound(cfg.name);
      ok(res, item);
    }),
  );

  r.post(
    '/',
    validate({ body: cfg.schema }),
    asyncHandler(async (req, res) => {
      const data = cfg.beforeSave ? cfg.beforeSave(req, req.body) : req.body;
      const item = await cfg.model.create(data);
      bumpContentVersion();
      await audit(req, { action: `${cfg.name}.create`, entity: cfg.name, entityId: item._id, summary: `Created ${cfg.name}` });
      created(res, item);
    }),
  );

  r.put(
    '/:id',
    validate({ body: cfg.schema }),
    asyncHandler(async (req, res) => {
      const existing = await cfg.model.findById(req.params.id).lean<Record<string, unknown>>();
      if (!existing) throw AppError.notFound(cfg.name);
      const data = cfg.beforeSave ? cfg.beforeSave(req, req.body, existing) : req.body;
      const item = await cfg.model.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
      bumpContentVersion();
      await audit(req, { action: `${cfg.name}.update`, entity: cfg.name, entityId: req.params.id, changes: shallowDiff(existing, data) });
      ok(res, item);
    }),
  );

  r.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await cfg.model.findByIdAndDelete(req.params.id);
      if (!item) throw AppError.notFound(cfg.name);
      bumpContentVersion();
      await audit(req, { action: `${cfg.name}.delete`, entity: cfg.name, entityId: req.params.id, summary: `Deleted ${cfg.name}` });
      ok(res, { deleted: true });
    }),
  );
  return r;
}
