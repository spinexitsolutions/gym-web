import { Router } from 'express';
import { z } from 'zod';
import { slugSchema } from '@apex/shared';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { CouponModel, MembershipPlanModel } from '../models';
import { audit } from '../services/audit.service';
import { bumpContentVersion } from '../services/cms.service';
import { AppError } from '../utils/AppError';
import { shallowDiff } from '../utils/diff';
import { asyncHandler, created, ok } from '../utils/http';

const r = Router();

const publicPlan = (p: Record<string, unknown>) => {
  const { __v, ...rest } = p;
  void __v;
  return { ...rest, id: String(p._id) };
};

r.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = await MembershipPlanModel.find({ active: true }).sort({ order: 1, priceMinor: 1 }).lean();
    ok(res, plans.map(publicPlan));
  }),
);

export const planSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  tagline: z.string().trim().max(140).default(''),
  description: z.string().trim().max(2000).default(''),
  durationDays: z.number().int().min(1).max(1830),
  priceMinor: z.number().int().min(0).max(100_000_000),
  compareAtMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  benefits: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  limits: z
    .object({ classesPerWeek: z.number().int().min(0).max(50).nullable().default(null), ptSessions: z.number().int().min(0).max(100).default(0), guestPasses: z.number().int().min(0).max(100).default(0) })
    .default({}),
  isTrial: z.boolean().default(false),
  promoLabel: z.string().trim().max(40).default(''),
  highlight: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().min(0).max(1000).default(50),
  cancellationPolicy: z.string().trim().max(1000).default(''),
  refundableDays: z.number().int().min(0).max(60).default(0),
});

const admin = Router();
admin.use(requireAuth, requirePermission('plans:write'));

admin.get('/', asyncHandler(async (_req, res) => ok(res, (await MembershipPlanModel.find().sort({ order: 1 }).lean()).map(publicPlan))));
admin.post(
  '/',
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    const plan = await MembershipPlanModel.create(req.body);
    bumpContentVersion();
    await audit(req, { action: 'plan.create', entity: 'MembershipPlan', entityId: plan._id, summary: `Created plan ${plan.name}` });
    created(res, plan);
  }),
);
admin.put(
  '/:id',
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    const before = await MembershipPlanModel.findById(req.params.id).lean<Record<string, unknown>>();
    if (!before) throw AppError.notFound('Plan');
    // Existing memberships keep their purchase snapshot; price changes only affect new orders.
    const plan = await MembershipPlanModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    bumpContentVersion();
    await audit(req, { action: 'plan.update', entity: 'MembershipPlan', entityId: req.params.id, changes: shallowDiff(before, req.body) });
    ok(res, plan);
  }),
);
admin.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Plans are archived rather than deleted to keep payment/membership history intact.
    const plan = await MembershipPlanModel.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true });
    if (!plan) throw AppError.notFound('Plan');
    bumpContentVersion();
    await audit(req, { action: 'plan.archive', entity: 'MembershipPlan', entityId: plan._id, summary: `Archived plan ${plan.name}` });
    ok(res, plan);
  }),
);

/* Coupons */
export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(3).max(30).regex(/^[A-Z0-9_-]+$/),
    description: z.string().trim().max(200).default(''),
    type: z.enum(['percent', 'flat']),
    value: z.number().int().min(1),
    maxDiscountMinor: z.number().int().min(0).optional().nullable(),
    minAmountMinor: z.number().int().min(0).default(0),
    validFrom: z.coerce.date().optional().nullable(),
    validUntil: z.coerce.date().optional().nullable(),
    usageLimit: z.number().int().min(1).optional().nullable(),
    perUserLimit: z.number().int().min(1).default(1),
    plans: z.array(z.string().regex(/^[a-f0-9]{24}$/)).default([]),
    newMembersOnly: z.boolean().default(false),
    active: z.boolean().default(true),
    campaign: z.string().trim().max(60).default(''),
  })
  .refine((c) => c.type !== 'percent' || c.value <= 100, { path: ['value'], message: 'Percent must be 100 or less' });

admin.get('/coupons/all', asyncHandler(async (_req, res) => ok(res, await CouponModel.find().sort({ createdAt: -1 }).lean())));
admin.post(
  '/coupons',
  validate({ body: couponSchema }),
  asyncHandler(async (req, res) => {
    const c = await CouponModel.create(req.body);
    await audit(req, { action: 'coupon.create', entity: 'Coupon', entityId: c._id, summary: `Created coupon ${c.code}` });
    created(res, c);
  }),
);
admin.put(
  '/coupons/:id',
  validate({ body: couponSchema }),
  asyncHandler(async (req, res) => {
    const before = await CouponModel.findById(req.params.id).lean<Record<string, unknown>>();
    if (!before) throw AppError.notFound('Coupon');
    const c = await CouponModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    await audit(req, { action: 'coupon.update', entity: 'Coupon', entityId: req.params.id, changes: shallowDiff(before, req.body) });
    ok(res, c);
  }),
);
admin.delete(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    const c = await CouponModel.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true });
    if (!c) throw AppError.notFound('Coupon');
    await audit(req, { action: 'coupon.deactivate', entity: 'Coupon', entityId: c._id, summary: `Deactivated coupon ${c.code}` });
    ok(res, c);
  }),
);

r.use('/admin', admin);
export default r;
