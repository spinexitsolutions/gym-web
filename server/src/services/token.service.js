import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { Session } from '../models/index.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { ApiError } from '../utils/ApiError.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export function cookieBase() {
  return {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
  };
}

const durationMs = (s) => {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 15 * 60 * 1000;
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
};

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
    algorithm: 'HS256',
  });

async function createSession(user, { family, userAgent }) {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 864e5);
  await Session.create({
    user: user._id,
    tokenHash: sha256(token),
    family: family || randomToken(16),
    expiresAt,
    userAgent: userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

function setAuthCookies(res, accessToken, refresh) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    httpOnly: true,
    maxAge: durationMs(env.JWT_ACCESS_EXPIRES),
  });
  // Refresh cookie is only sent to the auth endpoints.
  res.cookie(REFRESH_COOKIE, refresh.token, {
    ...cookieBase(),
    httpOnly: true,
    path: '/api/auth',
    expires: refresh.expiresAt,
  });
}

export async function issueTokens(res, user, req) {
  const refresh = await createSession(user, { userAgent: req.get('user-agent') });
  setAuthCookies(res, signAccessToken(user), refresh);
}

// Rotates the refresh token. Presenting an already-revoked token revokes the entire family.
export async function rotateRefreshToken(req, res, loadUser) {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw ApiError.unauthorized('Session expired. Please log in again.');
  const session = await Session.findOne({ tokenHash: sha256(presented) });
  if (!session || session.expiresAt < new Date()) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }
  if (session.revokedAt) {
    await Session.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date() });
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session was revoked. Please log in again.');
  }
  const user = await loadUser(session.user);
  if (!user || user.status !== 'active') {
    session.revokedAt = new Date();
    await session.save();
    clearAuthCookies(res);
    throw ApiError.unauthorized('Account is not active.');
  }
  session.revokedAt = new Date();
  await session.save();
  const refresh = await createSession(user, { family: session.family, userAgent: req.get('user-agent') });
  setAuthCookies(res, signAccessToken(user), refresh);
  return user;
}

export async function revokeCurrentSession(req) {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) await Session.updateOne({ tokenHash: sha256(presented) }, { revokedAt: new Date() });
}

export const revokeAllSessions = (userId) =>
  Session.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), httpOnly: true, path: '/api/auth' });
}
