/**
 * Fetch wrapper for the REST API.
 *  - Sends cookies (httpOnly access/refresh tokens) with every request.
 *  - Adds the CSRF double-submit header on mutating requests.
 *  - On 401, performs a single shared refresh (/auth/refresh) and retries once.
 *  - Normalises errors into ApiError { status, code, message, details }.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api/v1';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field errors keyed by the last path segment (e.g. "body.email" → "email"). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as FieldIssue[]) {
        if (d && typeof d.path === 'string') out[d.path.replace(/^(body|query|params)\./, '')] = d.message;
      }
    }
    return out;
  }
}

let csrfToken: string | null = null;

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1];
}

export async function ensureCsrf(): Promise<string> {
  const fromCookie = readCookie('apex_csrf');
  if (fromCookie) return (csrfToken = decodeURIComponent(fromCookie));
  if (csrfToken) return csrfToken;
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  const json = await res.json();
  csrfToken = json.data.csrfToken as string;
  return csrfToken;
}

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const token = await ensureCsrf();
        const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': token } });
        if (res.status === 409) {
          // Another tab refreshed concurrently; its cookies are now ours.
          await new Promise((r) => setTimeout(r, 300));
          return true;
        }
        return res.ok;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401. */
  noRefresh?: boolean;
  raw?: boolean;
}

export interface Paged<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; pages: number; [k: string]: unknown };
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  return BASE.startsWith('http') ? url.toString() : url.pathname + url.search;
}

async function doFetch(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET') headers['X-CSRF-Token'] = await ensureCsrf();
  return fetch(buildUrl(path, opts.query), { method, headers, body, credentials: 'include', signal: opts.signal });
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<Paged<T>> {
  let res: Response;
  try {
    res = await doFetch(path, opts);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection and try again.');
  }
  if (res.status === 401 && !opts.noRefresh && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await doFetch(path, opts);
    else onSessionExpired?.();
  }
  if (res.status === 403) {
    const peek = await res.clone().json().catch(() => null);
    if (peek?.error?.code === 'CSRF_FAILED') {
      csrfToken = null;
      res = await doFetch(path, opts);
    }
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(res.status, json?.error?.code ?? 'HTTP_ERROR', json?.error?.message ?? `Request failed (${res.status})`, json?.error?.details);
  }
  if (opts.raw) return { data: res as unknown as T };
  if (res.status === 204) return { data: undefined as T };
  return (await res.json()) as Paged<T>;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) => apiRequest<T>(path, { query, signal }).then((r) => r.data),
  getPaged: <T>(path: string, query?: RequestOptions['query']) => apiRequest<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }).then((r) => r.data),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }).then((r) => r.data),
  upload: <T>(path: string, form: FormData) => apiRequest<T>(path, { method: 'POST', body: form }).then((r) => r.data),
  /** Absolute URL for downloads (CSV, PDF receipts). Cookies authenticate the request. */
  url: (path: string, query?: RequestOptions['query']) => buildUrl(path, query),
};

/** Downloads a file from an authenticated endpoint. */
export async function download(path: string, query?: RequestOptions['query'], fallbackName = 'download') {
  const { data } = await apiRequest<Response>(path, { query, raw: true });
  const res = data as unknown as Response;
  const blob = await res.blob();
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
