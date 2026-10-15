import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';
import { randomToken } from '../../utils/crypto';

export interface StoredFile {
  storage: 'local' | 'cloudinary';
  key: string;
  url: string;
}

export const uploadRoot = () => path.resolve(process.cwd(), env.UPLOAD_DIR);

const extFor: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'model/gltf-binary': 'glb',
};

if (env.STORAGE_DRIVER === 'cloudinary') {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
}

/**
 * Stores a file. Public files are served at /uploads/public/... (local) or via Cloudinary's CDN.
 * Private files (progress photos) are never publicly addressable: local files live outside the
 * static directory and Cloudinary uses `authenticated` delivery with short-lived signed URLs.
 */
export async function storeFile(buffer: Buffer, mime: string, opts: { visibility: 'public' | 'private'; folder: string }): Promise<StoredFile> {
  const ext = extFor[mime] ?? 'bin';
  const name = `${Date.now().toString(36)}-${randomToken(9)}.${ext}`;
  const folder = opts.folder.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'general';
  if (env.STORAGE_DRIVER === 'cloudinary') {
    const resourceType = mime.startsWith('image/') ? 'image' : 'raw';
    const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: `${env.CLOUDINARY_FOLDER}/${opts.visibility}/${folder}`, resource_type: resourceType, type: opts.visibility === 'private' ? 'authenticated' : 'upload', public_id: name.replace(/\.[^.]+$/, '') },
          (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
        )
        .end(buffer);
    });
    return { storage: 'cloudinary', key: result.public_id, url: opts.visibility === 'public' ? result.secure_url : '' };
  }
  const rel = path.posix.join(opts.visibility, folder, name);
  const abs = path.join(uploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer, { mode: 0o640 });
  return { storage: 'local', key: rel, url: opts.visibility === 'public' ? `/uploads/${rel}` : '' };
}

export async function deleteFile(storage: 'local' | 'cloudinary', key: string, mime = 'image/jpeg') {
  if (storage === 'cloudinary') {
    await cloudinary.uploader.destroy(key, { resource_type: mime.startsWith('image/') ? 'image' : 'raw' }).catch(() => undefined);
    return;
  }
  const abs = path.join(uploadRoot(), key);
  if (!abs.startsWith(uploadRoot())) return;
  await fs.unlink(abs).catch(() => undefined);
}

/** Absolute local path of a private file (local driver), guarded against traversal. */
export function localPath(key: string) {
  const abs = path.resolve(uploadRoot(), key);
  if (!abs.startsWith(uploadRoot() + path.sep)) throw new Error('Invalid key');
  return abs;
}

export function signedPrivateUrl(key: string) {
  return cloudinary.url(key, { type: 'authenticated', sign_url: true, secure: true, expires_at: Math.floor(Date.now() / 1000) + 300 });
}
