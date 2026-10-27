// Strips keys starting with '$' or containing '.' from body/query/params to block MongoDB operator injection
// (e.g. { "email": { "$gt": "" } }). Also trims nothing and never logs values.
function clean(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      delete value[key];
    } else {
      value[key] = clean(value[key], depth + 1);
    }
  }
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  if (req.query) clean(req.query);
  next();
}
