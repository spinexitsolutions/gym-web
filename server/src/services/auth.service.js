import { User, MemberProfile } from '../models/index.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { ApiError } from '../utils/ApiError.js';
import { sendEmail, emailTemplates } from './email.service.js';
import { revokeAllSessions } from './token.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

async function uniqueReferralCode(name) {
  const prefix = name.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  for (let i = 0; i < 5; i += 1) {
    const code = `${prefix}${randomToken(3).toUpperCase()}`;
    if (!(await MemberProfile.exists({ referralCode: code }))) return code;
  }
  return `${prefix}${randomToken(5).toUpperCase()}`;
}

export async function sendVerification(user) {
  const token = randomToken(32);
  user.emailVerifyTokenHash = sha256(token);
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();
  await sendEmail(emailTemplates.verifyEmail(user, token));
}

export async function register({ name, email, password, phone, referralCode }) {
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');

  let referredBy;
  if (referralCode) {
    const referrer = await MemberProfile.findOne({ referralCode }).select('user');
    if (!referrer) throw ApiError.badRequest('Referral code not found', [{ field: 'referralCode', message: 'Referral code not found' }]);
    referredBy = referrer.user;
  }

  const user = await User.create({ name, email, password, phone, role: 'member' });
  try {
    await MemberProfile.create({ user: user._id, referralCode: await uniqueReferralCode(name), referredBy });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // keep user + profile consistent
    throw err;
  }
  await sendVerification(user);
  return user;
}

export async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerifyTokenHash: sha256(token),
    emailVerifyExpires: { $gt: new Date() },
  }).select('+emailVerifyTokenHash +emailVerifyExpires');
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  return user;
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');
  const invalid = ApiError.unauthorized('Incorrect email or password');
  if (!user || user.status === 'deleted') {
    await new Promise((r) => setTimeout(r, 150)); // reduce user-enumeration timing differences
    throw invalid;
  }
  if (user.isLocked()) throw ApiError.tooMany('Too many failed attempts. Try again in 15 minutes or reset your password.');

  const okPassword = await user.comparePassword(password);
  if (!okPassword) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw invalid;
  }
  if (user.status === 'suspended') throw ApiError.forbidden('This account is suspended. Please contact the front desk.');

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email, status: { $ne: 'deleted' } });
  if (!user) return; // same response whether or not the account exists
  const token = randomToken(32);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  await sendEmail(emailTemplates.resetPassword(user, token));
}

export async function resetPassword({ token, password }) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.lockUntil = undefined;
  user.emailVerified = true; // they proved control of the inbox
  await user.save();
  await revokeAllSessions(user._id);
  await sendEmail(emailTemplates.passwordChanged(user));
  return user;
}
