import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ICON_TYPES = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];

function uploader({ types, maxBytes }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!types.includes(file.mimetype)) return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
      cb(null, true);
    },
  });
}

export const uploadImage = uploader({ types: IMAGE_TYPES, maxBytes: 8 * 1024 * 1024 }).single('file');
export const uploadVideo = uploader({ types: VIDEO_TYPES, maxBytes: 80 * 1024 * 1024 }).single('file');
export const uploadIcon = uploader({ types: ICON_TYPES, maxBytes: 512 * 1024 }).single('file');

// Magic-byte check so a renamed file with a fake Content-Type is rejected.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  'image/avif': (b) => b.toString('ascii', 4, 8) === 'ftyp' && /avi[fs]/.test(b.toString('ascii', 8, 12)),
  'video/mp4': (b) => b.toString('ascii', 4, 8) === 'ftyp',
  'video/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

export function verifyFileSignature(req, _res, next) {
  if (!req.file) return next(ApiError.badRequest('No file uploaded (field name must be "file")'));
  const check = SIGNATURES[req.file.mimetype];
  if (check && !check(req.file.buffer)) return next(ApiError.badRequest('File contents do not match its type'));
  next();
}
