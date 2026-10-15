import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../utils/AppError';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/**
 * Validates and replaces req.body / req.query / req.params with parsed values.
 * Parsed query is stored on `res.locals.query` because Express' req.query is a getter in some setups.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          AppError.validation(
            'Please check the highlighted fields',
            result.error.issues.map((i) => ({ path: [part, ...i.path].join('.'), message: i.message })),
          ),
        );
      }
      if (part === 'query') res.locals.query = result.data;
      else (req as unknown as Record<string, unknown>)[part] = result.data;
    }
    next();
  };
}

/** Typed accessor for validated query params. */
export const q = <S extends ZodTypeAny>(res: { locals: Record<string, unknown> }, _schema: S): z.infer<S> => res.locals.query as z.infer<S>;
