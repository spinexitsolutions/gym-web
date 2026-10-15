import type { RequestHandler } from 'express';
import { env, isProd } from '../config/env';
import { AppError } from '../utils/AppError';
import { randomToken, safeEqual } from '../utils/crypto';

export const CSRF_COOKIE = 'apex_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated requests.
 * The token is readable by our own JS (cookie + GET /auth/csrf) and must be echoed in the X-CSRF-Token header.
 * Combined with SameSite=Lax cookies and a strict CORS allowlist.
 */
export const issueCsrf: RequestHandler = (req, res, next) => {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomToken(24);
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE || isProd,
      domain: env.COOKIE_DOMAIN,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    req.cookies = { ...(req.cookies ?? {}), [CSRF_COOKIE]: token };
  }
  next();
};

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(new AppError(403, 'CSRF_FAILED', 'Security token missing or invalid. Refresh the page and try again.'));
  }
  next();
};
