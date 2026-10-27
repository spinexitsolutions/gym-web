import mongoose from 'mongoose';

const MAX_LIMIT = 100;

export function parsePagination(query, { defaultLimit = 20, sortable = ['createdAt'], defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  let sort = defaultSort;
  if (typeof query.sort === 'string') {
    const field = query.sort.replace(/^-/, '');
    if (sortable.includes(field)) sort = query.sort;
  }
  return { page, limit, skip: (page - 1) * limit, sort };
}

export async function paginate(model, filter, opts, { select, populate, lean = true } = {}) {
  let q = model.find(filter).sort(opts.sort).skip(opts.skip).limit(opts.limit);
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);
  if (lean) q = q.lean();
  const [items, total] = await Promise.all([q, model.countDocuments(filter)]);
  return {
    items,
    meta: { page: opts.page, limit: opts.limit, total, pages: Math.max(1, Math.ceil(total / opts.limit)) },
  };
}

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Aggregation pipelines do not cast strings like find() does; convert validated ids explicitly.
export const oid = (id) => new mongoose.Types.ObjectId(String(id));
