import { ApiError } from '../utils/ApiError.js';
import { randomToken, safeEqual } from '../utils/crypto.js';
import { cookieBase } from '../services/token.service.js';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit cookie: the token lives in a readable cookie and must be echoed in a header on every
// state-changing request. A cross-site attacker can make the browser send the cookie but cannot read it.
export function issueCsrfToken(req, res) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomToken(32);
    res.cookie(CSRF_COOKIE, token, { ...cookieBase(), httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7 });
  }
  return token;
}

export function csrfProtection({ exempt = [] } = {}) {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method) || exempt.some((p) => req.path.startsWith(p))) return next();
    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.get(CSRF_HEADER);
    if (!cookie || !header || !safeEqual(cookie, header)) {
      return next(new ApiError(403, 'Invalid or missing CSRF token. Refresh the page and try again.'));
    }
    next();
  };
}
