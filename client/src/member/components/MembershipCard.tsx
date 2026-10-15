import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, Sparkles, Ticket } from 'lucide-react';
import { Badge, ButtonLink, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { MembershipView } from '@/types/api';
import { ProgressRing } from './ProgressRing';

function totalDays(m: MembershipView) {
  return Math.max(1, Math.round((new Date(m.endDate).getTime() - new Date(m.startDate).getTime()) / 86400000));
}

/** Hero card for the member's current membership, with a days-left ring. */
export function MembershipCard({ membership, upcoming, actions, className }: { membership: MembershipView | null; upcoming?: MembershipView | null; actions?: ReactNode; className?: string }) {
  if (!membership) {
    return (
      <div className={cn('card relative overflow-hidden p-6 md:p-7', className)}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
            <Ticket className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">Membership</p>
            <h2 className="font-display text-xl font-semibold md:text-2xl">You don’t have an active membership yet</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {upcoming
                ? `Your ${upcoming.planName} membership starts on ${fmtDate(upcoming.startDate)}. Class bookings open from that date.`
                : 'Choose a plan to unlock class bookings, check-ins and coaching. Pay securely online — your membership activates as soon as the payment is confirmed.'}
            </p>
          </div>
          {!upcoming && (
            <ButtonLink to="/member/membership#plans" icon={<ArrowRight className="h-4 w-4" />} className="shrink-0">
              View plans
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  const total = totalDays(membership);
  const left = membership.daysLeft ?? 0;
  const ratio = left / total;
  const tone = left <= 3 ? 'danger' : left <= 14 ? 'warning' : 'primary';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn('card relative overflow-hidden', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.07]" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center md:p-7">
        <ProgressRing value={ratio} size={132} stroke={11} tone={tone} label={`${left} of ${total} days left`}>
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums leading-none">{left}</p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted">days left</p>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Your membership</p>
            <StatusBadge status={membership.status} />
            {membership.isTrial && <Badge tone="info">Trial</Badge>}
            {membership.cancellationRequestedAt && <Badge tone="warning">Cancellation requested</Badge>}
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-3xl">{membership.planName}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <CalendarClock className="h-4 w-4" />
            {fmtDate(membership.startDate)} → <span className="text-fg">{fmtDate(membership.endDate)}</span>
          </p>
          {left <= 14 && !upcoming && <p className="mt-2 text-sm text-warning">Ending soon — renew now so your training isn’t interrupted. Renewals start the day this one ends.</p>}
          {upcoming && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs text-success ring-1 ring-success/20">
              <Sparkles className="h-3.5 w-3.5" /> Next up: {upcoming.planName} from {fmtDate(upcoming.startDate)}
            </p>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </motion.div>
  );
}
