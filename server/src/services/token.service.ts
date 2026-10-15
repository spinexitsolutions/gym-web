import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env, isProd } from '../config/env';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../middleware/auth';
import { SessionModel } from '../models';
import { randomToken, sha256 } from '../utils/crypto';
import { AppError } from '../utils/AppError';

const cookieBase = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || isProd,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
});

export function signAccessToken(userId: string) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`, issuer: 'apex', algorithm: 'HS256' });
}

export async function createSession(userId: string | Types.ObjectId, userAgent?: string, family?: string) {
  const token = randomToken(48);
  await SessionModel.create({
    user: userId,
    tokenHash: sha256(token),
    family: family ?? randomToken(12),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    userAgent: userAgent?.slice(0, 300),
  });
  return token;
}

export function setAuthCookies(res: Response, userId: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, signAccessToken(userId), { ...cookieBase(), path: '/', maxAge: env.ACCESS_TOKEN_TTL_MIN * 60000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), path: '/api/v1/auth', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/v1/auth' });
}

/**
 * Rotates a refresh token. If a token that was already rotated is presented again
 * (likely theft), the whole session family is revoked.
 */
export async function rotateRefreshToken(token: string, userAgent?: string): Promise<{ userId: string; refreshToken: string }> {
  const session = await SessionModel.findOne({ tokenHash: sha256(token) });
  if (!session || session.expiresAt < new Date()) throw AppError.unauthorized('Session expired. Please log in again.');
  if (session.revokedAt || session.rotatedAt) {
    // A rotated token is being replayed. Allow a short grace window for concurrent tab refreshes.
    const graceMs = 10_000;
    if (session.rotatedAt && !session.revokedAt && Date.now() - session.rotatedAt.getTime() < graceMs) {
      throw new AppError(409, 'REFRESH_RACE', 'Session refreshed in another tab');
    }
    await SessionModel.updateMany({ family: session.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw AppError.unauthorized('Session expired. Please log in again.');
  }
  // Atomic claim so two concurrent refreshes cannot both rotate the same token.
  const claimed = await SessionModel.findOneAndUpdate({ _id: session._id, rotatedAt: null, revokedAt: null }, { $set: { rotatedAt: new Date() } });
  if (!claimed) throw new AppError(409, 'REFRESH_RACE', 'Session refreshed in another tab');
  const refreshToken = await createSession(session.user, userAgent, session.family);
  return { userId: String(session.user), refreshToken };
}

export async function revokeSession(token: string) {
  await SessionModel.updateOne({ tokenHash: sha256(token) }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string | Types.ObjectId) {
  await SessionModel.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
