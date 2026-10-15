import multer from 'multer';
import { env } from '../config/env';

/** Files are held in memory, validated by magic bytes, re-encoded and then stored. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_IMAGE_MB * 1024 * 1024, files: 10, fields: 20 },
});

export const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_MODEL_MB * 1024 * 1024, files: 1, fields: 10 },
});
