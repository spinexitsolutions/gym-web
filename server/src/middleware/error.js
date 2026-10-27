import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { isProd, isTest } from '../config/env.js';
import { ErrorLog } from '../models/index.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`));
}

 
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  }

  if (status >= 500) {
    // Log the error without request bodies (which may contain passwords or tokens).
    console.error(`[${req.method} ${req.originalUrl.split('?')[0]}]`, err.stack || err);
    if (!isTest && mongoose.connection.readyState === 1) {
      ErrorLog.create({
        method: req.method, path: req.originalUrl.split('?')[0], status, user: req.user?._id,
        message: String(err.message || '').slice(0, 500), stack: String(err.stack || '').slice(0, 4000),
      }).catch(() => {});
    }
    if (isProd && !(err instanceof ApiError)) message = 'Internal server error';
  }

  const body = { success: false, message };
  if (details) body.details = details;
  res.status(status).json(body);
}
