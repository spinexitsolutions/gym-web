import { z } from 'zod';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, paginate, escapeRegex } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { audit } from '../services/audit.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';

/**
 * Builds list/get/create/update/delete handlers for an admin-managed collection.
 * config: { name, model, schema, searchFields, filters (zod shape), populate, slugFrom, sortable, defaultSort,
 *           beforeWrite(data, req, existing), beforeDelete(doc, req), afterWrite(doc, req, action) }
 */
export function resource(config) {
  const {
    name, model, schema, searchFields = [], filters = {}, populate, slugFrom, sortable = ['createdAt', 'order'],
    defaultSort = '-createdAt', beforeWrite, beforeDelete, afterWrite,
  } = config;
  const updateSchema = config.updateSchema || schema.partial();
  const listQuery = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().max(40).optional(),
    q: z.string().trim().max(100).optional(),
    ...filters,
  });

  async function uniqueSlug(base, excludeId) {
    const root = slugify(base) || name;
    let slug = root;
    for (let i = 2; await model.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) }); i += 1) slug = `${root}-${i}`;
    return slug;
  }

  const list = async (req, res) => {
    const { page: _p, limit: _l, sort: _s, q, ...rest } = req.query;
    const filter = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== '') filter[k] = v === 'true' ? true : v === 'false' ? false : v;
    if (q && searchFields.length) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    const opts = parsePagination(req.query, { sortable, defaultSort });
    const { items, meta } = await paginate(model, filter, opts, { populate });
    return ok(res, items, { meta });
  };

  const get = async (req, res) => {
    let q = model.findById(req.params.id);
    if (populate) q = q.populate(populate);
    const doc = await q.lean();
    if (!doc) throw ApiError.notFound(`${name} not found`);
    return ok(res, doc);
  };

  const create = async (req, res) => {
    const data = { ...req.body };
    if (slugFrom && 'slug' in model.schema.paths) data.slug = await uniqueSlug(data.slug || data[slugFrom]);
    if (beforeWrite) await beforeWrite(data, req, null);
    const doc = await model.create(data);
    await audit(req, { action: `${name}.create`, entity: model.modelName, entityId: doc._id, summary: data[slugFrom] || data.title || data.name || data.code });
    if (afterWrite) await afterWrite(doc, req, 'create');
    return created(res, doc, `${name[0].toUpperCase()}${name.slice(1)} created`);
  };

  const update = async (req, res) => {
    const doc = await model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${name} not found`);
    const data = { ...req.body };
    if (slugFrom && data.slug !== undefined) data.slug = await uniqueSlug(data.slug || data[slugFrom] || doc[slugFrom], doc._id);
    if (beforeWrite) await beforeWrite(data, req, doc);
    doc.set(data);
    await doc.save();
    await audit(req, { action: `${name}.update`, entity: model.modelName, entityId: doc._id, changes: { fields: Object.keys(data) } });
    if (afterWrite) await afterWrite(doc, req, 'update');
    return ok(res, doc, { message: 'Saved' });
  };

  const remove = async (req, res) => {
    const doc = await model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${name} not found`);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    await audit(req, { action: `${name}.delete`, entity: model.modelName, entityId: doc._id, summary: doc[slugFrom] || doc.title || doc.name || doc.code });
    return ok(res, null, { message: 'Deleted' });
  };

  // Mounts the routes on a router; `guard` is the role middleware.
  const mount = (router, path, guard, { readGuard = guard } = {}) => {
    router.get(path, readGuard, validate({ query: listQuery }), h(list));
    router.get(`${path}/:id`, readGuard, validate({ params: idParam }), h(get));
    router.post(path, guard, validate({ body: schema }), h(create));
    router.patch(`${path}/:id`, guard, validate({ params: idParam, body: updateSchema }), h(update));
    router.delete(`${path}/:id`, guard, validate({ params: idParam }), h(remove));
  };

  return { list, get, create, update, remove, mount };
}
