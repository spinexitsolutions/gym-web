import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    document.cookie = 'apex_csrf=csrf123';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns data and sends the CSRF header on mutations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: { ok: true } }));
    await expect(api.post('/things', { a: 1 })).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf123');
    expect(init!.credentials).toBe('include');
    expect(init!.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('normalises API errors including field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(422, { error: { code: 'VALIDATION_ERROR', message: 'Please check', details: [{ path: 'body.email', message: 'Invalid email' }] } }));
    const err = await api.post('/auth/register', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.fieldErrors).toEqual({ email: 'Invalid email' });
  });

  it('turns network failures into a friendly error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.get('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('refreshes the session once on 401 and retries the request', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'no' } }))
      .mockResolvedValueOnce(json(200, { data: { user: {} } }))
      .mockResolvedValueOnce(json(200, { data: ['retried'] }));
    await expect(api.get('/members/me/dashboard')).resolves.toEqual(['retried']);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not loop when the refresh fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }));
    const err = await api.get('/members/me').catch((e) => e);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
