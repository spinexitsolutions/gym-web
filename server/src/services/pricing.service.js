import { MembershipPlan, Membership, Coupon, Payment } from '../models/index.js';
import { BILLING_PERIODS } from '../models/MembershipPlan.js';
import { ApiError } from '../utils/ApiError.js';

const fieldError = (field, message) => ApiError.badRequest(message, [{ field, message }]);

// Pure calculation, exported for unit tests.
export function couponDiscount(coupon, basePaise) {
  if (!coupon) return 0;
  let d = coupon.discountType === 'percent' ? Math.floor((basePaise * coupon.value) / 100) : Math.round(coupon.value);
  if (coupon.maxDiscountPaise) d = Math.min(d, coupon.maxDiscountPaise);
  return Math.max(0, Math.min(d, basePaise));
}

export async function validateCoupon(code, { userId, planId, basePaise }) {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  const invalid = (msg) => fieldError('couponCode', msg);
  if (!coupon || !coupon.isActive) throw invalid('This coupon code is not valid');
  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) throw invalid('This coupon is not active yet');
  if (coupon.validTo && coupon.validTo < now) throw invalid('This coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw invalid('This coupon has been fully redeemed');
  if (coupon.applicablePlans?.length && !coupon.applicablePlans.some((p) => String(p) === String(planId))) {
    throw invalid('This coupon does not apply to the selected plan');
  }
  if (coupon.minAmountPaise && basePaise < coupon.minAmountPaise) throw invalid('Order amount is below the minimum for this coupon');
  if (coupon.owner && String(coupon.owner) !== String(userId) && coupon.kind === 'referral') {
    throw invalid('This referral reward belongs to another member');
  }
  if (coupon.perUserLimit) {
    const used = await Payment.countDocuments({ user: userId, coupon: coupon._id, status: { $in: ['paid', 'refund_requested'] } });
    if (used >= coupon.perUserLimit) throw invalid('You have already used this coupon');
  }
  return coupon;
}

// Server-side price for a plan purchase. The client never sends an amount.
export async function quote({ userId, planId, period, couponCode }) {
  const plan = await MembershipPlan.findOne({ _id: planId, status: 'published', isActive: true });
  if (!plan) throw ApiError.notFound('This plan is not available');
  const option = plan.pricing.find((p) => p.period === period);
  if (!option) throw fieldError('period', 'This billing period is not offered for the selected plan');

  const hasHistory = await Membership.exists({ user: userId, status: { $in: ['active', 'expired', 'pending', 'cancelled'] } });
  const joiningFeePaise = hasHistory ? 0 : plan.joiningFeePaise || 0;
  const basePaise = option.pricePaise;
  const coupon = couponCode ? await validateCoupon(couponCode, { userId, planId: plan._id, basePaise }) : null;
  const discountPaise = couponDiscount(coupon, basePaise);
  return {
    plan,
    period,
    months: BILLING_PERIODS[period],
    basePaise,
    joiningFeePaise,
    discountPaise,
    amountPaise: basePaise - discountPaise + joiningFeePaise,
    coupon,
    isRenewal: Boolean(hasHistory),
  };
}

export const publicQuote = (q) => ({
  plan: { id: q.plan._id, name: q.plan.name, slug: q.plan.slug, tier: q.plan.tier },
  period: q.period,
  months: q.months,
  basePaise: q.basePaise,
  joiningFeePaise: q.joiningFeePaise,
  discountPaise: q.discountPaise,
  amountPaise: q.amountPaise,
  coupon: q.coupon ? { code: q.coupon.code, description: q.coupon.description } : null,
  isRenewal: q.isRenewal,
});
