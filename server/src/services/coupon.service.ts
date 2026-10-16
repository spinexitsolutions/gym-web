import type { Types } from 'mongoose';
import { CouponModel, CouponRedemptionModel, MembershipModel, type Coupon } from '../models';
import { AppError } from '../utils/AppError';

/** Smallest chargeable online amount (Razorpay minimum is ₹1). */
export const MIN_CHARGE_MINOR = 100;

function couponError(message: string): AppError {
  return AppError.validation(message, [{ path: 'body.couponCode', message }]);
}

/** Validates a coupon for a user/plan and returns the discount in minor units. All checks are server-side. */
export async function applyCoupon(code: string, userId: string | Types.ObjectId, plan: { _id: Types.ObjectId; priceMinor: number }) {
  const coupon = await CouponModel.findOne({ code: code.trim().toUpperCase() });
  const now = new Date();
  if (!coupon || !coupon.active) throw couponError('This coupon code is not valid');
  if (coupon.validFrom && coupon.validFrom > now) throw couponError('This coupon is not active yet');
  if (coupon.validUntil && coupon.validUntil < now) throw couponError('This coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw couponError('This coupon has reached its usage limit');
  if (coupon.plans?.length && !coupon.plans.some((p) => String(p) === String(plan._id))) throw couponError('This coupon does not apply to the selected plan');
  if (coupon.minAmountMinor && plan.priceMinor < coupon.minAmountMinor) throw couponError('This plan does not meet the coupon minimum');
  const uses = await CouponRedemptionModel.countDocuments({ coupon: coupon._id, user: userId });
  if (uses >= (coupon.perUserLimit ?? 1)) throw couponError('You have already used this coupon');
  if (coupon.newMembersOnly) {
    // Any previous non-trial membership (paid, offline or staff-granted) disqualifies.
    const had = await MembershipModel.exists({ user: userId, 'planSnapshot.isTrial': { $ne: true } });
    if (had) throw couponError('This coupon is for new members only');
  }
  let discount = computeDiscount(coupon, plan.priceMinor);
  // Never leave a non-zero balance below the provider minimum.
  const remaining = plan.priceMinor - discount;
  if (remaining > 0 && remaining < MIN_CHARGE_MINOR) discount = plan.priceMinor - MIN_CHARGE_MINOR;
  return { coupon, discountMinor: Math.max(0, discount) };
}

export function computeDiscount(coupon: Pick<Coupon, 'type' | 'value' | 'maxDiscountMinor'>, baseMinor: number): number {
  let d = coupon.type === 'percent' ? Math.floor((baseMinor * Math.min(coupon.value, 100)) / 100) : coupon.value;
  if (coupon.maxDiscountMinor) d = Math.min(d, coupon.maxDiscountMinor);
  return Math.min(d, baseMinor);
}
