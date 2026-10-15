import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps async route handlers so rejected promises reach the error middleware (Express 4). */
export const asyncHandler =
  <P = Record<string, string>>(fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler<P> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201);
}
