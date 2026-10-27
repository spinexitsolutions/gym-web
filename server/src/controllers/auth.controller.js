import { User, MemberProfile } from '../models/index.js';
import * as authService from '../services/auth.service.js';
import { issueTokens, rotateRefreshToken, revokeCurrentSession, revokeAllSessions, clearAuthCookies } from '../services/token.service.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { ok, created } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';

async function mePayload(user) {
  const profile = user.role === 'member' ? await MemberProfile.findOne({ user: user._id }).lean() : null;
  return { user: user.toSafeJSON(), profile };
}

export const csrf = (req, res) => ok(res, { csrfToken: issueCsrfToken(req, res) });

export async function register(req, res) {
  const user = await authService.register(req.body);
  await issueTokens(res, user, req);
  return created(res, await mePayload(user), 'Account created. Check your inbox to verify your email.');
}

export async function login(req, res) {
  const user = await authService.login(req.body);
  await issueTokens(res, user, req);
  return ok(res, await mePayload(user), { message: 'Welcome back' });
}

export async function refresh(req, res) {
  const user = await rotateRefreshToken(req, res, (id) => User.findById(id));
  return ok(res, await mePayload(user));
}

export async function logout(req, res) {
  await revokeCurrentSession(req);
  clearAuthCookies(res);
  return ok(res, null, { message: 'Logged out' });
}

export async function logoutAll(req, res) {
  await revokeAllSessions(req.user._id);
  clearAuthCookies(res);
  return ok(res, null, { message: 'Logged out of all devices' });
}

export const me = async (req, res) => ok(res, await mePayload(req.user));

export async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body.token);
  return ok(res, null, { message: 'Email verified. Thank you!' });
}

export async function resendVerification(req, res) {
  if (req.user.emailVerified) throw ApiError.badRequest('Email is already verified');
  await authService.sendVerification(req.user);
  return ok(res, null, { message: 'Verification email sent' });
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  return ok(res, null, { message: 'If an account exists for that email, a reset link has been sent.' });
}

export async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  clearAuthCookies(res);
  return ok(res, null, { message: 'Password updated. Please log in with your new password.' });
}
