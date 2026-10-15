import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let error: AppError;
  if (err instanceof AppError) error = err;
  else if (err instanceof ZodError) {
    error = AppError.validation('Invalid input', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  } else if (err instanceof multer.MulterError) {
    error = AppError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : `Upload error: ${err.message}`);
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = AppError.validation(
      'Invalid data',
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    error = AppError.badRequest(`Invalid value for ${err.path}`);
  } else if ((err as { code?: number }).code === 11000) {
    const fields = Object.keys((err as { keyPattern?: object }).keyPattern ?? {});
    error = AppError.conflict(`A record with this ${fields.join(', ') || 'value'} already exists`, { fields });
  } else if ((err as { type?: string }).type === 'entity.parse.failed') {
    error = AppError.badRequest('Malformed JSON body');
  } else if ((err as { type?: string }).type === 'entity.too.large') {
    error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
  if (error.status >= 500 && err instanceof AppError) logger.error({ err, path: req.path }, error.message);
  res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
};
