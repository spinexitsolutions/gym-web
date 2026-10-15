import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Permission, Role } from '@apex/shared';
import { env } from '../config/env';
import { UserModel } from '../models';
import { AppError } from '../utils/AppError';

export const ACCESS_COOKIE = 'apex_at';
export const REFRESH_COOKIE = 'apex_rt';

export interface AuthUser {
  id: string;
  role: Role;
  permissions: Permission[];
  name: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Reads the access-token cookie and loads the user from the database on every request,
 * so role changes and suspensions apply immediately. The role in the token is never trusted.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'apex' }) as { sub: string };
    const user = await UserModel.findById(payload.sub).select('role permissions status name email').lean();
    if (user && user.status === 'active') {
      req.user = { id: String(user._id), role: user.role as Role, permissions: (user.permissions ?? []) as Permission[], name: user.name, email: user.email };
    }
  } catch {
    // Expired or invalid token: treat as anonymous. The client refreshes via /auth/refresh.
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };

export function hasPermission(user: AuthUser | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.permissions.includes(permission);
}

/** Admins pass; other roles need the permission explicitly granted. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!hasPermission(req.user, permission)) return next(AppError.forbidden());
    next();
  };

export const isStaff = (u?: AuthUser) => u?.role === 'admin' || u?.role === 'trainer';
