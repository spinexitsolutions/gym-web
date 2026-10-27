import { User, MemberProfile } from '../models/index.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadBuffer, deleteAsset } from '../services/upload.service.js';
import { revokeAllSessions, issueTokens } from '../services/token.service.js';
import { sendEmail, emailTemplates } from '../services/email.service.js';

export async function updateMe(req, res) {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone || undefined;
  await req.user.save();
  return ok(res, { user: req.user.toSafeJSON() }, { message: 'Account updated' });
}

export async function getProfile(req, res) {
  const profile = await MemberProfile.findOne({ user: req.user._id })
    .populate('assignedTrainer', 'name slug photo title')
    .lean();
  return ok(res, { user: req.user.toSafeJSON(), profile });
}

export async function updateProfile(req, res) {
  const profile = await MemberProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return ok(res, { profile }, { message: 'Profile saved' });
}

export async function uploadAvatar(req, res) {
  const uploaded = await uploadBuffer(req.file.buffer, { folder: 'avatars' });
  const previous = req.user.avatar?.publicId;
  req.user.avatar = { url: uploaded.url, publicId: uploaded.publicId, alt: req.user.name };
  await req.user.save();
  if (previous) await deleteAsset(previous);
  return ok(res, { user: req.user.toSafeJSON() }, { message: 'Profile photo updated' });
}

export async function removeAvatar(req, res) {
  const previous = req.user.avatar?.publicId;
  req.user.avatar = undefined;
  await req.user.save();
  if (previous) await deleteAsset(previous);
  return ok(res, { user: req.user.toSafeJSON() });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Validation failed', [{ field: 'currentPassword', message: 'Current password is incorrect' }]);
  }
  user.password = req.body.newPassword;
  await user.save();
  // Sign out every other device, then give this browser a fresh session.
  await revokeAllSessions(user._id);
  await issueTokens(res, user, req);
  await sendEmail(emailTemplates.passwordChanged(user));
  return ok(res, null, { message: 'Password changed. Other devices have been signed out.' });
}

export async function requestDeletion(req, res) {
  if (req.user.deletionRequestedAt) throw ApiError.conflict('A deletion request is already pending');
  req.user.deletionRequestedAt = new Date();
  req.user.deletionReason = req.body.reason;
  await req.user.save();
  return ok(res, { user: req.user.toSafeJSON() }, {
    message: 'Deletion request received. Our team will process it within 7 days; you can cancel it until then.',
  });
}

export async function cancelDeletion(req, res) {
  req.user.deletionRequestedAt = undefined;
  req.user.deletionReason = undefined;
  await req.user.save();
  return ok(res, { user: req.user.toSafeJSON() }, { message: 'Deletion request cancelled' });
}
