import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, CalendarPlus, History, Repeat, X } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { Alert, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Skeleton, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, relativeTime } from '@/lib/format';
import type { Booking, ClassItem } from '@/types/api';
import { BookingRow, bookingTitle } from '../components/BookingRow';

type Scope = 'upcoming' | 'past';

export default function BookingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { site } = useSite();
  const policy = site?.settings.bookings;
  const cancelH = policy?.cancellationWindowHours ?? 4;
  const reschedH = policy?.rescheduleWindowHours ?? 4;
  const [scope, setScope] = useState<Scope>('upcoming');
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);

  const q = useQuery({ queryKey: ['member', 'bookings', scope], queryFn: () => api.get<Booking[]>('/bookings/me', { scope }) });

  const cancel = useMutation({
    mutationFn: (b: Booking) => api.post(`/bookings/${b._id}/cancel`, { reason: 'Cancelled by member' }),
    onSuccess: () => {
      toast.success('Booking cancelled', 'Your spot has been released to the next person.');
      setCancelling(null);
      void qc.invalidateQueries({ queryKey: ['member'] });
    },
    onError: (err) => toast.error(err),
  });

  const hoursUntil = (b: Booking) => (new Date(b.startsAt).getTime() - Date.now()) / 3600000;
  const lateCancel = cancelling && cancelling.status === 'confirmed' && hoursUntil(cancelling) < cancelH;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Training"
        title="My bookings"
        description={`Cancel up to ${cancelH} hours and reschedule up to ${reschedH} hours before a session starts. Waitlist spots can be released anytime.`}
        actions={
          <ButtonLink to="/member/book" size="sm" icon={<CalendarPlus className="h-4 w-4" />}>
            Book a class
          </ButtonLink>
        }
      />
      <Tabs<Scope>
        className="mb-5 w-fit"
        value={scope}
        onChange={setScope}
        tabs={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past & cancelled' },
        ]}
      />

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !q.data?.length ? (
        scope === 'upcoming' ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="No upcoming sessions"
            description="Book a group class or a 1:1 with a coach to get your week planned."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/member/book">Browse classes</ButtonLink>
                <ButtonLink to="/member/personal-training" variant="secondary">
                  Personal training
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <EmptyState icon={<History className="h-5 w-5" />} title="No past sessions yet" description="Attended, missed and cancelled sessions will show up here." />
        )
      ) : (
        <ul className="space-y-3">
          {q.data.map((b, i) => {
            const canReschedule = scope === 'upcoming' && b.type === 'class' && hoursUntil(b) >= reschedH;
            const canCancel = scope === 'upcoming' && b.active;
            return (
              <motion.li key={b._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                <BookingRow
                  booking={b}
                  actions={
                    scope === 'upcoming' ? (
                      <>
                        {canReschedule && (
                          <Button size="sm" variant="secondary" icon={<Repeat className="h-3.5 w-3.5" />} onClick={() => setRescheduling(b)}>
                            Reschedule
                          </Button>
                        )}
                        {canCancel && (
                          <Button size="sm" variant="ghost" className="text-danger" icon={<X className="h-3.5 w-3.5" />} onClick={() => setCancelling(b)}>
                            {b.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel'}
                          </Button>
                        )}
                      </>
                    ) : null
                  }
                />
                {scope === 'upcoming' && <p className="mt-1 pl-1 text-xs text-muted">Starts {relativeTime(b.startsAt)}</p>}
              </motion.li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        loading={cancel.isPending}
        tone="danger"
        title={cancelling?.status === 'waitlisted' ? 'Leave the waitlist?' : 'Cancel this booking?'}
        confirmLabel={cancelling?.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel booking'}
        description={cancelling ? `${bookingTitle(cancelling)} · ${fmtDate(cancelling.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} at ${fmtTime(cancelling.startsAt)}` : undefined}
      >
        {lateCancel ? (
          <Alert tone="warning" title="Inside the cancellation window">
            Confirmed bookings can only be cancelled online up to {cancelH} hours before the start. Please contact the front desk if you can’t make it.
          </Alert>
        ) : (
          <p className="text-sm text-muted">Your spot is released immediately{cancelling?.type === 'class' ? ' and offered to the first person on the waitlist' : ''}.</p>
        )}
      </ConfirmDialog>

      <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)} />
    </div>
  );
}

function RescheduleModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [choice, setChoice] = useState<string | null>(null);
  const classes = useQuery({ queryKey: ['member', 'classes', 14], queryFn: () => api.get<ClassItem[]>('/classes', { days: 14, limit: 200 }), enabled: Boolean(booking) });
  const options = useMemo(() => {
    if (!booking) return [];
    const title = booking.gymClass?.title;
    return (classes.data ?? [])
      .filter((c) => c.status === 'scheduled' && c.id !== booking.gymClass?._id && new Date(c.startsAt) > new Date())
      .sort((a, b) => Number(b.title === title) - Number(a.title === title) || +new Date(a.startsAt) - +new Date(b.startsAt))
      .slice(0, 30);
  }, [classes.data, booking]);

  const move = useMutation({
    mutationFn: () => api.post<Booking>(`/bookings/${booking!._id}/reschedule`, { classId: choice }),
    onSuccess: (b) => {
      toast.success(b.status === 'waitlisted' ? 'Moved to the waitlist' : 'Booking rescheduled', `${fmtDate(b.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} at ${fmtTime(b.startsAt)}`);
      setChoice(null);
      onClose();
      void qc.invalidateQueries({ queryKey: ['member'] });
    },
    onError: (err) => toast.error(err),
  });

  return (
    <Modal
      open={Boolean(booking)}
      onClose={() => (setChoice(null), onClose())}
      size="lg"
      title="Reschedule booking"
      description={booking ? `Currently: ${bookingTitle(booking)} · ${fmtDate(booking.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} ${fmtTime(booking.startsAt)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep current
          </Button>
          <Button disabled={!choice} loading={move.isPending} onClick={() => move.mutate()}>
            Move booking
          </Button>
        </>
      }
    >
      {classes.isError ? (
        <ErrorState error={classes.error} onRetry={() => classes.refetch()} />
      ) : classes.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : options.length === 0 ? (
        <EmptyState title="No other classes in the next two weeks" className="py-8" />
      ) : (
        <ul className="space-y-2" role="radiogroup" aria-label="New class">
          {options.map((c) => (
            <li key={c.id}>
              <button
                role="radio"
                aria-checked={choice === c.id}
                onClick={() => setChoice(c.id)}
                className={cn('flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition', choice === c.id ? 'border-primary bg-primary/10' : 'border-line hover:border-fg/25')}
              >
                <span>
                  <span className="block font-medium">{c.title}</span>
                  <span className="text-xs text-muted">
                    {fmtDate(c.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(c.startsAt)}
                    {c.trainer ? ` · ${c.trainer.name}` : ''}
                  </span>
                </span>
                <span className={cn('shrink-0 text-xs', c.spotsLeft > 0 ? 'text-muted' : 'text-warning')}>{c.spotsLeft > 0 ? `${c.spotsLeft} left` : 'Waitlist'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
