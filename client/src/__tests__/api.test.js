import { describe, it, expect, vi, beforeEach } from 'vitest';

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe('api client', () => {
  beforeEach(() => vi.resetModules());

  it('sends the CSRF token on unsafe requests and includes cookies', async () => {
    const fetch = vi.fn((url) => (url.endsWith('/auth/csrf') ? json(200, { data: { csrfToken: 'tok' } }) : json(200, { success: true, data: 1 })));
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('../services/api.js');
    await api.post('/contact', { a: 1 });
    const [, opts] = fetch.mock.calls.at(-1);
    expect(opts.headers['X-CSRF-Token']).toBe('tok');
    expect(opts.credentials).toBe('include');
  });

  it('refreshes once on 401 and retries the request', async () => {
    let calls = 0;
    const fetch = vi.fn((url) => {
      if (url.endsWith('/auth/csrf')) return json(200, { data: { csrfToken: 'tok' } });
      if (url.endsWith('/auth/refresh')) return json(200, { success: true, data: {} });
      calls += 1;
      return calls === 1 ? json(401, { message: 'Authentication required' }) : json(200, { success: true, data: 'ok' });
    });
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('../services/api.js');
    expect((await api.get('/auth/me')).data).toBe('ok');
    expect(fetch.mock.calls.filter(([u]) => u.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('surfaces validation details as field errors', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (url.endsWith('/auth/csrf')
      ? json(200, { data: { csrfToken: 't' } })
      : json(400, { message: 'Validation failed', details: [{ field: 'email', message: 'Taken' }] }))));
    const { api, ApiError } = await import('../services/api.js');
    const err = await api.post('/auth/register', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldErrors()).toEqual({ email: 'Taken' });
  });
});
