import { ApiError } from '../utils/ApiError.js';

// validate({ body: schema, query: schema, params: schema }) — replaces each part with the parsed value,
// so unknown keys are stripped and types coerced before controllers run.
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[part] = result.data;
  }
  next();
};
