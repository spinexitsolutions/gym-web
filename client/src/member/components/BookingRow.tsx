import type { ReactNode } from 'react';
import { MapPin, UserRound } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Booking } from '@/types/api';

export const bookingTitle = (b: Booking) => (b.type === 'class' ? (b.gymClass?.title ?? 'Class') : b.type === 'personal_training' ? 'Personal training' : 'Trial session');

/** Calendar tile with weekday/day/month. */
export function DateTile({ date, className }: { date: string; className?: string }) {
  return (
    <div className={cn('grid w-14 shrink-0 place-items-center rounded-2xl bg-fg/[0.05] py-2 text-center ring-1 ring-line', className)}>
      <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-primary">{fmtDate(date, { weekday: 'short' })}</span>
      <span className="font-display text-xl font-semibold leading-tight">{fmtDate(date, { day: 'numeric' })}</span>
      <span className="text-[0.62rem] uppercase tracking-wider text-muted">{fmtDate(date, { month: 'short' })}</span>
    </div>
  );
}

export function BookingRow({ booking, actions, compact }: { booking: Booking; actions?: ReactNode; compact?: boolean }) {
  const trainer = booking.trainer && typeof booking.trainer === 'object' ? booking.trainer.name : null;
  return (
    <div className={cn('flex items-center gap-3', !compact && 'rounded-2xl border border-line/80 bg-fg/[0.02] p-3 sm:p-4')}>
      <DateTile date={booking.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{bookingTitle(booking)}</p>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
          {trainer && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {trainer}
            </span>
          )}
          {booking.gymClass?.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {booking.gymClass.location}
            </span>
          )}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">{actions}</div>}
    </div>
  );
}
