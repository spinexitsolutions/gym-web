import type { Request, Response } from 'express';
import { CSRF_COOKIE } from '../middleware/csrf';
import { REFRESH_COOKIE } from '../middleware/auth';
import { UserModel, publicUser } from '../models';
import * as auth from '../services/auth.service';
import { clearAuthCookies, createSession, revokeSession, rotateRefreshToken, setAuthCookies } from '../services/token.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';
import { env } from '../config/env';

export async function csrf(req: Request, res: Response) {
  ok(res, { csrfToken: req.cookies[CSRF_COOKIE] });
}

export async function register(req: Request, res: Response) {
  const user = await auth.registerMember(req.body);
  if (env.REQUIRE_EMAIL_VERIFICATION) {
    return ok(res, { user: null, verificationRequired: true }, undefined, 201);
  }
  const refresh = await createSession(user._id, req.get('user-agent'));
  setAuthCookies(res, String(user._id), refresh);
  ok(res, { user: publicUser(user), verificationRequired: false }, undefined, 201);
}

export async function login(req: Request, res: Response) {
  const user = await auth.authenticateCredentials(req.body.email, req.body.password);
  const refresh = await createSession(user._id, req.get('user-agent'));
  setAuthCookies(res, String(user._id), refresh);
  ok(res, { user: publicUser(user) });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies[REFRESH_COOKIE];
  if (!token) throw AppError.unauthorized('No session');
  try {
    const { userId, refreshToken } = await rotateRefreshToken(token, req.get('user-agent'));
    const user = await UserModel.findById(userId);
    if (!user || user.status !== 'active') {
      clearAuthCookies(res);
      throw AppError.unauthorized('Session expired. Please log in again.');
    }
    setAuthCookies(res, userId, refreshToken);
    ok(res, { user: publicUser(user) });
  } catch (err) {
    if (err instanceof AppError && err.status === 401) clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies[REFRESH_COOKIE];
  if (token) await revokeSession(token);
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw AppError.unauthorized();
  ok(res, { user: publicUser(user) });
}

export async function forgotPassword(req: Request, res: Response) {
  await auth.requestPasswordReset(req.body.email);
  ok(res, { message: 'If an account exists for that email, a reset link has been sent.' });
}

export async function resetPassword(req: Request, res: Response) {
  await auth.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  ok(res, { message: 'Password updated. Please log in with your new password.' });
}

export async function verifyEmail(req: Request, res: Response) {
  await auth.verifyEmail(req.body.token);
  ok(res, { message: 'Email verified.' });
}

export async function resendVerification(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (user && !user.emailVerified) await auth.sendVerificationEmail(user);
  ok(res, { message: 'Verification email sent.' });
}

export async function changePassword(req: Request, res: Response) {
  await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  const refresh = await createSession(req.user!.id, req.get('user-agent'));
  setAuthCookies(res, req.user!.id, refresh);
  ok(res, { message: 'Password changed. Other devices have been signed out.' });
}
