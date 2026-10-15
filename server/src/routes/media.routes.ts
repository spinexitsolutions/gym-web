import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { hasPermission, requireAuth, requirePermission } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import { imageUpload, modelUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { MediaAssetModel } from '../models';
import { canAccessMember } from '../services/access.service';
import { audit } from '../services/audit.service';
import { processImageUpload, processModelUpload } from '../services/media.service';
import { deleteFile, localPath, signedPrivateUrl } from '../services/storage';
import { AppError } from '../utils/AppError';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';

const r = Router();
r.use(requireAuth);

/**
 * Streams a private asset (progress photo) after ownership checks:
 * the owner, admins with members:read, or the assigned trainer when the member opted in.
 */
r.get(
  '/private/:id',
  asyncHandler(async (req, res) => {
    const asset = await MediaAssetModel.findOne({ _id: req.params.id, visibility: 'private' }).lean();
    if (!asset || !asset.owner) throw AppError.notFound('File');
    const owner = String(asset.owner);
    let allowed = owner === req.user!.id || hasPermission(req.user, 'members:read');
    if (!allowed && req.user!.role === 'trainer' && (await canAccessMember(req.user!, owner))) {
      const { MemberProfileModel } = await import('../models');
      allowed = Boolean(await MemberProfileModel.exists({ user: owner, progressPhotosSharedWithTrainer: true }));
    }
    if (!allowed) throw AppError.notFound('File');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (asset.storage === 'cloudinary') return res.redirect(302, signedPrivateUrl(asset.key));
    res.type(asset.mime);
    fs.createReadStream(localPath(asset.key)).on('error', () => res.status(404).end()).pipe(res);
  }),
);

const media = Router();
media.use(requirePermission('media:write'));

media.get(
  '/',
  validate({ query: listQuery.extend({ kind: z.enum(['image', 'model']).optional(), folder: z.string().trim().max(60).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, q, kind, folder } = res.locals.query;
    const filter: Record<string, unknown> = { visibility: 'public' };
    if (kind) filter.kind = kind;
    if (folder) filter.folder = folder;
    if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
    const [items, total, folders] = await Promise.all([
      MediaAssetModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MediaAssetModel.countDocuments(filter),
      MediaAssetModel.distinct('folder', { visibility: 'public' }),
    ]);
    ok(res, items, { ...pageMeta(page, limit, total), folders });
  }),
);

const folderSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,40}$/).default('general');

media.post(
  '/images',
  uploadLimiter,
  imageUpload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw AppError.badRequest('Choose at least one image to upload');
    const folder = folderSchema.parse(req.body.folder ?? 'general');
    const results: unknown[] = [];
    const errors: { file: string; message: string }[] = [];
    for (const f of files) {
      try {
        results.push(await processImageUpload(f, { visibility: 'public', folder, uploadedBy: req.user!.id, alt: String(req.body.alt ?? '').slice(0, 200) }));
      } catch (err) {
        errors.push({ file: f.originalname, message: err instanceof AppError ? err.message : 'Upload failed' });
      }
    }
    if (!results.length) throw AppError.badRequest(errors[0]?.message ?? 'Upload failed', errors);
    created(res, { uploaded: results, errors });
  }),
);

media.post(
  '/models',
  uploadLimiter,
  modelUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose a .glb file to upload');
    const asset = await processModelUpload(req.file, { uploadedBy: req.user!.id, name: String(req.body.name ?? '') });
    await audit(req, { action: 'model.upload', entity: 'MediaAsset', entityId: asset._id, summary: `Uploaded 3D model ${asset.name} (pending review)` });
    created(res, asset);
  }),
);

media.post(
  '/models/:id/review',
  requirePermission('cms:write'),
  validate({ body: z.object({ status: z.enum(['approved', 'rejected']), notes: z.string().trim().max(500).optional() }) }),
  asyncHandler(async (req, res) => {
    const asset = await MediaAssetModel.findOneAndUpdate(
      { _id: req.params.id, kind: 'model' },
      { $set: { 'model.status': req.body.status, 'model.notes': req.body.notes, 'model.reviewedBy': req.user!.id } },
      { new: true },
    );
    if (!asset) throw AppError.notFound('Model');
    await audit(req, { action: 'model.review', entity: 'MediaAsset', entityId: asset._id, summary: `Model ${asset.name} ${req.body.status}` });
    ok(res, asset);
  }),
);

media.patch(
  '/:id',
  validate({ body: z.object({ name: z.string().trim().min(1).max(160).optional(), alt: z.string().trim().max(200).optional(), folder: folderSchema.optional() }) }),
  asyncHandler(async (req, res) => {
    const asset = await MediaAssetModel.findOneAndUpdate({ _id: req.params.id, visibility: 'public' }, { $set: req.body }, { new: true });
    if (!asset) throw AppError.notFound('Media');
    ok(res, asset);
  }),
);

media.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const asset = await MediaAssetModel.findOne({ _id: req.params.id, visibility: 'public' });
    if (!asset) throw AppError.notFound('Media');
    await deleteFile(asset.storage as 'local' | 'cloudinary', asset.key, asset.mime);
    for (const v of asset.variants ?? []) if (v.key) await deleteFile(asset.storage as 'local' | 'cloudinary', v.key, 'image/webp');
    await asset.deleteOne();
    await audit(req, { action: 'media.delete', entity: 'MediaAsset', entityId: asset._id, summary: `Deleted ${asset.name}` });
    ok(res, { deleted: true, note: 'Pages that referenced this file will show their fallback until updated.' });
  }),
);

r.use('/', media);

export default r;
