// Every successful response uses { success: true, data, message?, meta? }.
export function ok(res, data, { status = 200, message, meta } = {}) {
  const body = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export const created = (res, data, message) => ok(res, data, { status: 201, message });
