import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@apex/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UserModel, publicUser } from '../models';
import { audit } from '../services/audit.service';
import { hashPassword, requestPasswordReset } from '../services/auth.service';
import { revokeAllSessions } from '../services/token.service';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';
import { asyncHandler, created, ok } from '../utils/http';
import { escapeRegex, listQuery, pageMeta } from '../utils/pagination';
import { emailSchema } from '../validators/auth.validators';

/** Staff account & permission management. Admin only. */
const r = Router();
r.use(requireAuth, requireRole('admin'));

r.get(
  '/',
  validate({ query: listQuery.extend({ role: z.enum(['admin', 'trainer', 'member']).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { page, limit, q, role } = res.locals.query;
    const filter: Record<string, unknown> = role ? { role } : { role: { $in: ['admin', 'trainer'] } };
    if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { email: { $regex: escapeRegex(q), $options: 'i' } }];
    const [users, total] = await Promise.all([UserModel.find(filter).sort({ role: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(), UserModel.countDocuments(filter)]);
    ok(res, users.map(publicUser), pageMeta(page, limit, total));
  }),
);

r.post(
  '/admins',
  validate({ body: z.object({ name: z.string().trim().min(2).max(100), email: emailSchema }) }),
  asyncHandler(async (req, res) => {
    if (await UserModel.exists({ email: req.body.email })) throw AppError.conflict('An account with this email already exists');
    const user = await UserModel.create({ ...req.body, role: 'admin', passwordHash: await hashPassword(randomToken(24)), emailVerified: true, createdBy: req.user!.id });
    await requestPasswordReset(user.email);
    await audit(req, { action: 'user.create_admin', entity: 'User', entityId: user._id, summary: `Created admin ${user.email}` });
    created(res, publicUser(user));
  }),
);

r.patch(
  '/:id/access',
  validate({ body: z.object({ role: z.enum(['admin', 'trainer', 'member']).optional(), permissions: z.array(z.enum(PERMISSIONS)).optional(), status: z.enum(['active', 'suspended']).optional() }) }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id && (req.body.role && req.body.role !== 'admin' || req.body.status === 'suspended')) {
      throw AppError.badRequest('You cannot remove your own admin access');
    }
    const target = await UserModel.findById(req.params.id);
    if (!target) throw AppError.notFound('User');
    if (target.role === 'admin' && (req.body.role && req.body.role !== 'admin' || req.body.status === 'suspended')) {
      const admins = await UserModel.countDocuments({ role: 'admin', status: 'active' });
      if (admins <= 1) throw AppError.conflict('At least one active admin is required');
    }
    const before = { role: target.role, permissions: target.permissions, status: target.status };
    if (req.body.role) target.role = req.body.role;
    if (req.body.permissions) target.permissions = req.body.permissions;
    if (req.body.status) target.status = req.body.status;
    await target.save();
    if (req.body.status === 'suspended' || (req.body.role && req.body.role !== before.role)) await revokeAllSessions(target._id);
    await audit(req, { action: 'user.access_change', entity: 'User', entityId: target._id, summary: `Changed access for ${target.email}`, changes: { before, after: { role: target.role, permissions: target.permissions, status: target.status } } });
    ok(res, publicUser(target));
  }),
);

export default r;
