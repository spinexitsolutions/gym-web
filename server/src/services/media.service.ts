import sharp from 'sharp';
import { env } from '../config/env';
import { MediaAssetModel } from '../models';
import { AppError } from '../utils/AppError';
import { storeFile } from './storage';

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
const MAX_DIMENSION = 8000;
const MIN_DIMENSION = 16;
const VARIANT_WIDTHS = [480, 1024, 1920];

/** Detects real file type from magic bytes (never trusts the browser-provided MIME or extension). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 12) === 'ftypavif') return 'image/avif';
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'glTF') return 'model/gltf-binary';
  return null;
}

const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

export async function processImageUpload(file: { buffer: Buffer; originalname: string; size: number }, opts: { visibility: 'public' | 'private'; folder: string; uploadedBy: string; owner?: string; alt?: string; name?: string }) {
  if (file.size > env.MAX_IMAGE_MB * 1024 * 1024) throw AppError.badRequest(`Images must be ${env.MAX_IMAGE_MB} MB or smaller`);
  if (!ALLOWED_IMAGE_EXT.test(file.originalname)) throw AppError.badRequest('Allowed image types: JPG, PNG, WebP, AVIF, GIF');
  const mime = sniffMime(file.buffer);
  if (!mime || !IMAGE_MIME.includes(mime as (typeof IMAGE_MIME)[number])) throw AppError.badRequest('The file content is not a supported image (SVG is not accepted for security reasons)');

  let meta;
  try {
    meta = await sharp(file.buffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION }).metadata();
  } catch {
    throw AppError.badRequest('The image could not be read. It may be corrupted.');
  }
  if (!meta.width || !meta.height) throw AppError.badRequest('Could not determine image dimensions');
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) throw AppError.badRequest(`Images must be at most ${MAX_DIMENSION}px on each side`);
  if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) throw AppError.badRequest('Image is too small');

  // Re-encode (strips EXIF/GPS metadata) and auto-orient. GIFs are kept as-is to preserve animation.
  const isGif = mime === 'image/gif';
  const main = isGif ? file.buffer : await sharp(file.buffer).rotate().webp({ quality: 86 }).toBuffer();
  const mainMime = isGif ? mime : 'image/webp';
  const stored = await storeFile(main, mainMime, { visibility: opts.visibility, folder: opts.folder });

  const variants: { width: number; url: string; key: string }[] = [];
  if (!isGif && opts.visibility === 'public') {
    for (const w of VARIANT_WIDTHS) {
      if (w >= meta.width) continue;
      const buf = await sharp(file.buffer).rotate().resize({ width: w }).webp({ quality: 82 }).toBuffer();
      const v = await storeFile(buf, 'image/webp', { visibility: 'public', folder: opts.folder });
      variants.push({ width: w, url: v.url, key: v.key });
    }
  }
  const finalMeta = isGif ? meta : await sharp(main).metadata();
  return MediaAssetModel.create({
    kind: 'image',
    visibility: opts.visibility,
    storage: stored.storage,
    key: stored.key,
    url: stored.url,
    variants,
    name: (opts.name || file.originalname).replace(/\.[^.]+$/, '').slice(0, 160),
    originalName: file.originalname.slice(0, 255),
    folder: opts.folder,
    mime: mainMime,
    size: main.length,
    width: finalMeta.width,
    height: finalMeta.height,
    alt: opts.alt ?? '',
    owner: opts.owner,
    uploadedBy: opts.uploadedBy,
  });
}

/**
 * Validates a binary glTF (.glb) model:
 *  - magic/version/length header checks
 *  - JSON chunk parses; all buffers/images must be embedded (no external URIs that could
 *    reference arbitrary hosts or local files)
 *  - basic complexity limits (meshes, materials, approximate triangles) for performance
 * New models start as `pending` and must be approved by an admin before they can be used.
 */
export function inspectGlb(buf: Buffer) {
  if (buf.length < 20) throw AppError.badRequest('File is too small to be a GLB model');
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw AppError.badRequest('Not a binary glTF (.glb) file');
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw AppError.badRequest('Only glTF 2.0 models are supported');
  const length = buf.readUInt32LE(8);
  if (length !== buf.length) throw AppError.badRequest('GLB length header does not match file size');
  const chunkLength = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) throw AppError.badRequest('GLB is missing its JSON chunk');
  if (20 + chunkLength > buf.length) throw AppError.badRequest('GLB JSON chunk is truncated');
  let json: {
    buffers?: { uri?: string }[];
    images?: { uri?: string; bufferView?: number }[];
    meshes?: { primitives?: { indices?: number; attributes?: { POSITION?: number } }[] }[];
    materials?: unknown[];
    accessors?: { count?: number }[];
    extensionsRequired?: string[];
  };
  try {
    json = JSON.parse(buf.toString('utf8', 20, 20 + chunkLength));
  } catch {
    throw AppError.badRequest('GLB JSON chunk is not valid JSON');
  }
  const external = [...(json.buffers ?? []), ...(json.images ?? [])].some((x) => typeof x.uri === 'string' && !x.uri.startsWith('data:'));
  if (external) throw AppError.badRequest('Models must embed all textures and buffers (external URIs are not allowed)');
  const supportedExt = ['KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_texture_transform', 'KHR_materials_emissive_strength', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_mesh_quantization'];
  const unsupported = (json.extensionsRequired ?? []).filter((e) => !supportedExt.includes(e));
  if (unsupported.length) throw AppError.badRequest(`Unsupported required glTF extensions: ${unsupported.join(', ')} (Draco/meshopt compressed models are not supported yet)`);
  const meshes = json.meshes?.length ?? 0;
  const materials = json.materials?.length ?? 0;
  let triangles = 0;
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      const acc = p.indices !== undefined ? json.accessors?.[p.indices] : p.attributes?.POSITION !== undefined ? json.accessors?.[p.attributes.POSITION] : undefined;
      triangles += Math.floor((acc?.count ?? 0) / 3);
    }
  }
  if (meshes === 0) throw AppError.badRequest('The model contains no meshes');
  if (meshes > 200) throw AppError.badRequest('Model is too complex (more than 200 meshes)');
  if (triangles > 500_000) throw AppError.badRequest('Model is too complex (more than 500k triangles). Decimate it before uploading.');
  return { meshes, materials, triangles };
}

export async function processModelUpload(file: { buffer: Buffer; originalname: string; size: number }, opts: { uploadedBy: string; name?: string }) {
  if (file.size > env.MAX_MODEL_MB * 1024 * 1024) throw AppError.badRequest(`Models must be ${env.MAX_MODEL_MB} MB or smaller`);
  if (!/\.glb$/i.test(file.originalname)) throw AppError.badRequest('Upload models as a single .glb file');
  const stats = inspectGlb(file.buffer);
  const stored = await storeFile(file.buffer, 'model/gltf-binary', { visibility: 'public', folder: 'models' });
  return MediaAssetModel.create({
    kind: 'model',
    visibility: 'public',
    storage: stored.storage,
    key: stored.key,
    url: stored.url,
    name: (opts.name || file.originalname).replace(/\.[^.]+$/, '').slice(0, 160),
    originalName: file.originalname.slice(0, 255),
    folder: 'models',
    mime: 'model/gltf-binary',
    size: file.size,
    uploadedBy: opts.uploadedBy,
    model: { status: 'pending', ...stats },
  });
}
