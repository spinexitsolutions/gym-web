import type { ClientSession, Types } from 'mongoose';
import { MembershipModel, MembershipPlanModel, type Membership } from '../models';
import { addDays } from '../utils/dates';

export type MembershipMode = 'new' | 'renewal' | 'upgrade';

/** The membership currently granting access (status active and within dates). */
export async function getActiveMembership(userId: string | Types.ObjectId, at = new Date(), session?: ClientSession) {
  return MembershipModel.findOne({ user: userId, status: 'active', startDate: { $lte: at }, endDate: { $gt: at } })
    .sort({ endDate: -1 })
    .session(session ?? null);
}

export async function hasActiveMembership(userId: string | Types.ObjectId) {
  return Boolean(await getActiveMembership(userId));
}

/** Latest membership that is active or queued, used to decide where a renewal starts. */
export async function getLatestCurrentMembership(userId: string | Types.ObjectId, session?: ClientSession) {
  return MembershipModel.findOne({ user: userId, status: { $in: ['active', 'upcoming'] } })
    .sort({ endDate: -1 })
    .session(session ?? null);
}

export async function resolveMode(userId: string | Types.ObjectId, requested: 'auto' | 'upgrade'): Promise<MembershipMode> {
  const current = await getLatestCurrentMembership(userId);
  if (!current) return 'new';
  return requested === 'upgrade' ? 'upgrade' : 'renewal';
}

/**
 * Creates the membership granted by a verified payment (or an authorised admin action).
 *  - new:      starts now
 *  - renewal:  queued to start when the latest active/upcoming membership ends
 *  - upgrade:  starts now; the currently active membership is closed with status `upgraded`
 */
export async function grantMembership(
  input: {
    userId: string | Types.ObjectId;
    planId: string | Types.ObjectId;
    mode: MembershipMode;
    source: Membership['source'];
    paymentId?: Types.ObjectId;
    createdBy?: string;
    startDate?: Date;
  },
  session?: ClientSession,
) {
  const plan = await MembershipPlanModel.findById(input.planId).session(session ?? null);
  if (!plan) throw new Error('Plan not found');
  const now = new Date();
  let start = input.startDate ?? now;

  if (!input.startDate) {
    const current = await getLatestCurrentMembership(input.userId, session);
    if (current && input.mode === 'upgrade') {
      await MembershipModel.updateMany(
        { user: input.userId, status: 'active' },
        { $set: { status: 'upgraded', endDate: now } },
        { session },
      );
      start = now;
    } else if (current && current.endDate > now) {
      start = current.endDate;
    }
  }
  const end = addDays(start, plan.durationDays);
  const [membership] = await MembershipModel.create(
    [
      {
        user: input.userId,
        plan: plan._id,
        planSnapshot: { name: plan.name, durationDays: plan.durationDays, priceMinor: plan.priceMinor, isTrial: plan.isTrial },
        status: start <= now ? 'active' : 'upcoming',
        startDate: start,
        endDate: end,
        payment: input.paymentId,
        source: input.source,
        createdBy: input.createdBy,
      },
    ],
    { session },
  );
  return membership;
}

/** Moves memberships between upcoming → active → expired based on dates. Idempotent. */
export async function syncMembershipStatuses(now = new Date()) {
  const activated = await MembershipModel.updateMany({ status: 'upcoming', startDate: { $lte: now }, endDate: { $gt: now } }, { $set: { status: 'active' } });
  const expired = await MembershipModel.updateMany({ status: { $in: ['active', 'upcoming'] }, endDate: { $lte: now } }, { $set: { status: 'expired' } });
  return { activated: activated.modifiedCount, expired: expired.modifiedCount };
}

export function membershipView(m: Membership & { _id: unknown; createdAt?: Date }, now = new Date()) {
  const daysLeft = Math.max(0, Math.ceil((new Date(m.endDate).getTime() - now.getTime()) / 86400000));
  return {
    id: String(m._id),
    plan: String(m.plan),
    planName: m.planSnapshot?.name ?? "",
    isTrial: Boolean(m.planSnapshot?.isTrial),
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    daysLeft: m.status === 'active' ? daysLeft : null,
    source: m.source,
    payment: m.payment ? String(m.payment) : null,
    cancellationRequestedAt: m.cancellationRequestedAt ?? null,
    createdAt: m.createdAt,
  };
}
