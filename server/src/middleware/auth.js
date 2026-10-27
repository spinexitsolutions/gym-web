import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ACCESS_COOKIE } from '../services/token.service.js';

async function resolveUser(req) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null; // expired or tampered: client refreshes via /api/auth/refresh
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') return null;
  // Tokens issued before a password change are no longer valid.
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return user;
}

export async function authenticate(req, _res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    req.user = (await resolveUser(req)) || undefined;
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: authorize('owner', 'admin'). Owner implicitly passes every staff check.
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === 'owner' || roles.includes(req.user.role)) return next();
  return next(ApiError.forbidden());
};

export const requireVerifiedEmail = (req, _res, next) => {
  if (!req.user?.emailVerified) return next(ApiError.forbidden('Please verify your email address first'));
  next();
};
