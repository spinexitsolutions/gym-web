import { WebsiteSettings } from '../models/index.js';
import { defaultSettings } from './settings.defaults.js';
import { siteSettingsSchema } from '../validators/settings.validator.js';
import { ApiError } from '../utils/ApiError.js';

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Objects merge key-by-key; arrays and scalars replace.
export function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = v === undefined ? base[k] : deepMerge(base[k], v);
  return out;
}

let cache = { value: null, at: 0 };
const CACHE_MS = 30_000;
export const invalidateSettingsCache = () => { cache = { value: null, at: 0 }; };

async function getDoc() {
  let doc = await WebsiteSettings.findOne({ key: 'site' });
  if (!doc) {
    doc = await WebsiteSettings.create({ key: 'site', draft: defaultSettings, published: defaultSettings, publishedAt: new Date() });
  }
  return doc;
}

export async function getPublishedSettings() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await getDoc();
  // Merge onto defaults so newly added settings keys always have a value.
  const value = { ...deepMerge(defaultSettings, doc.published), publishedAt: doc.publishedAt, version: doc.version };
  cache = { value, at: Date.now() };
  return value;
}

export async function getDraftSettings() {
  const doc = await getDoc();
  return {
    draft: deepMerge(defaultSettings, doc.draft),
    publishedAt: doc.publishedAt,
    draftUpdatedAt: doc.draftUpdatedAt,
    version: doc.version,
    hasUnpublishedChanges: Boolean(doc.draftUpdatedAt && (!doc.publishedAt || doc.draftUpdatedAt > doc.publishedAt)),
  };
}

export async function saveDraft(patch, userId) {
  const doc = await getDoc();
  const next = deepMerge(deepMerge(defaultSettings, doc.draft), patch);
  const parsed = siteSettingsSchema.safeParse(next);
  if (!parsed.success) {
    throw ApiError.badRequest(
      'Validation failed',
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  doc.draft = parsed.data;
  doc.draftUpdatedAt = new Date();
  doc.draftUpdatedBy = userId;
  doc.markModified('draft');
  await doc.save();
  return getDraftSettings();
}

export async function publishDraft(userId) {
  const doc = await getDoc();
  const parsed = siteSettingsSchema.safeParse(deepMerge(defaultSettings, doc.draft));
  if (!parsed.success) throw ApiError.badRequest('Draft is invalid and cannot be published');
  doc.published = parsed.data;
  doc.publishedAt = new Date();
  doc.publishedBy = userId;
  doc.version += 1;
  doc.markModified('published');
  await doc.save();
  invalidateSettingsCache();
  return getDraftSettings();
}

export async function discardDraft(userId) {
  const doc = await getDoc();
  doc.draft = doc.published;
  doc.draftUpdatedAt = undefined;
  doc.draftUpdatedBy = userId;
  doc.markModified('draft');
  await doc.save();
  return getDraftSettings();
}
