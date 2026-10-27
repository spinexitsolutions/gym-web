// Thin fetch wrapper: sends cookies, attaches the CSRF token to unsafe requests and transparently refreshes
// an expired access token once before giving up.
const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  // Map server validation details onto react-hook-form fields.
  fieldErrors() {
    return Object.fromEntries((this.details || []).map((d) => [d.field, d.message]));
  }
}

let csrfToken = null;
let csrfPromise = null;
async function getCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  csrfPromise ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' })
    .then((r) => r.json())
    .then((b) => { csrfToken = b.data.csrfToken; return csrfToken; })
    .finally(() => { csrfPromise = null; });
  return csrfPromise;
}

let refreshPromise = null;
function refreshSession() {
  refreshPromise ??= raw('POST', '/auth/refresh', undefined, { retry: false })
    .then(() => true, () => false)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/reset-password'];

async function raw(method, path, body, { retry = true, signal, onUploadProgress } = {}) {
  const headers = {};
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (UNSAFE.has(method)) headers['X-CSRF-Token'] = await getCsrf();

  if (onUploadProgress && isForm) return xhrUpload(method, path, body, headers, onUploadProgress);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data;

  if (res.status === 401 && retry && !NO_REFRESH.includes(path) && (await refreshSession())) {
    return raw(method, path, body, { retry: false, signal });
  }
  if (res.status === 403 && retry && /CSRF/i.test(data?.message || '')) {
    await getCsrf(true);
    return raw(method, path, body, { retry: false, signal });
  }
  throw new ApiError(res.status, data?.message || `Request failed (${res.status})`, data?.details);
}

// XHR is used only for uploads because fetch has no upload-progress events.
function xhrUpload(method, path, form, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE}${path}`);
    xhr.withCredentials = true;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data?.message || 'Upload failed', data?.details));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));
    xhr.send(form);
  });
}

export const api = {
  get: (path, opts) => raw('GET', path, undefined, opts),
  post: (path, body, opts) => raw('POST', path, body, opts),
  patch: (path, body, opts) => raw('PATCH', path, body, opts),
  put: (path, body, opts) => raw('PUT', path, body, opts),
  delete: (path, opts) => raw('DELETE', path, undefined, opts),
};

// Convenience: unwrap { success, data, meta }.
export const getData = async (path, opts) => (await api.get(path, opts)).data;
