import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { MemberProfileModel, UserModel, type UserDoc } from '../models';
import { AppError } from '../utils/AppError';
import { randomToken, sha256 } from '../utils/crypto';
import { renderEmail, sendEmail } from './email.service';
import { ensureMemberProfile } from './member.service';
import { getSiteSettings } from './settings.service';
import { revokeAllSessions } from './token.service';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Used to keep login timing similar for unknown emails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function registerMember(input: { name: string; email: string; password: string; phone?: string; referralCode?: string }) {
  const exists = await UserModel.exists({ email: input.email });
  if (exists) throw AppError.conflict('An account with this email already exists. Try logging in instead.');
  let referredBy;
  if (input.referralCode) {
    const ref = await MemberProfileModel.findOne({ referralCode: input.referralCode }).select('user').lean();
    if (!ref) throw AppError.validation('Referral code not found', [{ path: 'body.referralCode', message: 'Referral code not found' }]);
    referredBy = ref.user;
  }
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    passwordHash: await hashPassword(input.password),
    role: 'member', // Public registration can only ever create members.
    status: 'active',
    qrToken: randomToken(18),
  });
  await ensureMemberProfile(user._id, { referredBy });
  await sendVerificationEmail(user);
  return user;
}

export async function authenticateCredentials(email: string, password: string) {
  const user = await UserModel.findOne({ email }).select('+passwordHash +failedLoginCount +lockUntil');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw AppError.unauthorized('Incorrect email or password');
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes or reset your password.`);
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = (user.failedLoginCount ?? 0) + 1;
    await UserModel.updateOne(
      { _id: user._id },
      failed >= MAX_FAILED ? { $set: { failedLoginCount: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } } : { $set: { failedLoginCount: failed } },
    );
    throw AppError.unauthorized('Incorrect email or password');
  }
  if (user.status === 'suspended') throw AppError.forbidden('This account is suspended. Please contact the front desk.');
  if (user.status === 'pending') throw AppError.forbidden('This account is not active yet.');
  if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified && user.role === 'member') {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address. We have sent you a new link.');
  }
  await UserModel.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockUntil: 1 } });
  return user;
}

export async function sendVerificationEmail(user: UserDoc) {
  const token = randomToken(32);
  await UserModel.updateOne({ _id: user._id }, { $set: { emailVerifyTokenHash: sha256(token), emailVerifyExpires: new Date(Date.now() + 48 * 3600000) } });
  const settings = await getSiteSettings();
  const url = `${env.PUBLIC_SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: `Verify your email for ${settings.brand.name}`,
    text: `Confirm your email address: ${url}`,
    html: renderEmail({ brand: settings.brand.name, heading: 'Confirm your email', paragraphs: [`Hi ${user.name}, confirm your email address to secure your account.`], cta: { label: 'Verify email', url } }),
  });
  return token;
}

export async function verifyEmail(token: string) {
  const user = await UserModel.findOneAndUpdate(
    { emailVerifyTokenHash: sha256(token), emailVerifyExpires: { $gt: new Date() } },
    { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: 1, emailVerifyExpires: 1 } },
  );
  if (!user) throw AppError.badRequest('This verification link is invalid or has expired.');
  return user;
}

export async function requestPasswordReset(email: string) {
  const user = await UserModel.findOne({ email, status: { $ne: 'suspended' } });
  if (!user) return; // Do not reveal whether the email exists.
  const token = randomToken(32);
  await UserModel.updateOne({ _id: user._id }, { $set: { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + 60 * 60000) } });
  const settings = await getSiteSettings();
  const url = `${env.PUBLIC_SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: `Reset your ${settings.brand.name} password`,
    text: `Reset your password (valid for 60 minutes): ${url}\n\nIf you didn't request this, ignore this email.`,
    html: renderEmail({ brand: settings.brand.name, heading: 'Reset your password', paragraphs: ['This link is valid for 60 minutes.', "If you didn't request a reset, you can safely ignore this email."], cta: { label: 'Choose a new password', url } }),
  });
}

export async function resetPassword(token: string, password: string) {
  const user = await UserModel.findOneAndUpdate(
    { resetTokenHash: sha256(token), resetExpires: { $gt: new Date() } },
    { $set: { passwordHash: await hashPassword(password), failedLoginCount: 0 }, $unset: { resetTokenHash: 1, resetExpires: 1, lockUntil: 1 } },
  );
  if (!user) throw AppError.badRequest('This reset link is invalid or has expired.');
  await revokeAllSessions(user._id);
  return user;
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw AppError.unauthorized();
  if (!(await verifyPassword(current, user.passwordHash))) throw AppError.validation('Current password is incorrect', [{ path: 'body.currentPassword', message: 'Current password is incorrect' }]);
  user.passwordHash = await hashPassword(next);
  await user.save();
  await revokeAllSessions(user._id);
}
