import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarX2, Check, Clock, Hourglass, MapPin, UserRound, Users } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { Alert, Badge, Button, ButtonLink, EmptyState, ErrorState, PageHeader, Select, Skeleton, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, titleCase } from '@/lib/format';
import type { Booking, ClassItem } from '@/types/api';
import { ProgressBar } from '../components/ProgressRing';
import { LEVELS, dayKey, todayKey } from '../components/utils';

export default function BookClassesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { site } = useSite();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => todayKey(i)), []);
  const [day, setDay] = useState(days[0]);
  const [level, setLevel] = useState('');
  const [trainer, setTrainer] = useState('');
  const [blocker, setBlocker] = useState<ApiError | null>(null);

  const classes = useQuery({ queryKey: ['member', 'classes', 14], queryFn: () => api.get<ClassItem[]>('/classes', { days: 14, limit: 200 }) });
  const mine = useQuery({ queryKey: ['member', 'bookings', 'upcoming'], queryFn: () => api.get<Booking[]>('/bookings/me', { scope: 'upcoming' }) });

  const bookedByClass = useMemo(() => {
    const m = new Map<string, Booking>();
    for (const b of mine.data ?? []) if (b.gymClass && b.active) m.set(b.gymClass._id, b);
    return m;
  }, [mine.data]);

  const upcoming = useMemo(() => (classes.data ?? []).filter((c) => new Date(c.startsAt) > new Date()), [classes.data]);
  const trainers = useMemo(() => {
    const m = new Map<string, string>();
    upcoming.forEach((c) => c.trainer && m.set(c.trainer.id, c.trainer.name));
    return [...m].map(([value, label]) => ({ value, label }));
  }, [upcoming]);
  const filtered = upcoming.filter((c) => (!level || c.level === level || c.level === 'all') && (!trainer || c.trainer?.id === trainer));
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => c.status === 'scheduled' && m.set(dayKey(c.startsAt), (m.get(dayKey(c.startsAt)) ?? 0) + 1));
    return m;
  }, [filtered]);
  const dayClasses = filtered.filter((c) => dayKey(c.startsAt) === day);

  // If nothing is left today, jump to the first day that has classes (once, on first load).
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || !classes.data) return;
    autoPicked.current = true;
    if (!upcoming.some((c) => dayKey(c.startsAt) === days[0] && c.status === 'scheduled')) {
      const next = upcoming.find((c) => c.status === 'scheduled');
      if (next) setDay(dayKey(next.startsAt));
    }
  }, [classes.data, upcoming, days]);

  const book = useMutation({
    mutationFn: (c: ClassItem) => api.post<Booking>('/bookings/class', { classId: c.id }),
    onSuccess: (b, c) => {
      setBlocker(null);
      if (b.status === 'waitlisted') toast.info(`Waitlisted for ${c.title}`, 'We’ll notify you the moment a spot opens.');
      else toast.success(`You’re in: ${c.title}`, `${fmtDate(c.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })} at ${fmtTime(c.startsAt)}`);
      void qc.invalidateQueries({ queryKey: ['member'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === 'MEMBERSHIP_REQUIRED' || /allowance|membership ends|up to \d+ upcoming/i.test(err.message))) setBlocker(err);
      else toast.error(err);
      void qc.invalidateQueries({ queryKey: ['member', 'classes'] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Training" title="Book a class" description={`Reserve your spot up to two weeks ahead. Free cancellation until ${site?.settings.bookings.cancellationWindowHours ?? 4} hours before start.`} />

      <AnimatePresence>
        {blocker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <Alert tone="warning" title={blocker.code === 'MEMBERSHIP_REQUIRED' ? 'Membership required' : 'Can’t book this one'}>
              <p>{blocker.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {blocker.code === 'MEMBERSHIP_REQUIRED' || /renew|allowance/i.test(blocker.message) ? (
                  <ButtonLink to="/member/membership#plans" size="sm">
                    {blocker.code === 'MEMBERSHIP_REQUIRED' ? 'View plans' : 'See plans'}
                  </ButtonLink>
                ) : (
                  <ButtonLink to="/member/bookings" size="sm" variant="secondary">
                    Manage bookings
                  </ButtonLink>
                )}
                <Button size="sm" variant="ghost" onClick={() => setBlocker(null)}>
                  Dismiss
                </Button>
              </div>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day strip */}
      <div role="tablist" aria-label="Choose a day" className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {days.map((k) => {
          const date = new Date(`${k}T12:00:00`);
          const n = countByDay.get(k) ?? 0;
          const selected = k === day;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={selected}
              aria-label={`${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${n} classes`}
              onClick={() => setDay(k)}
              className={cn(
                'relative flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition',
                selected ? 'border-primary bg-primary text-on-primary shadow-glow' : 'border-line bg-surface hover:border-fg/25',
              )}
            >
              <span className={cn('text-[0.65rem] font-semibold uppercase tracking-wider', selected ? 'text-on-primary/80' : 'text-muted')}>{k === days[0] ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <span className="font-display text-xl font-semibold">{date.getDate()}</span>
              <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (selected ? 'bg-on-primary' : 'bg-primary') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <Select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Any level" options={LEVELS.filter((l) => l.value !== 'all')} />
        <Select aria-label="Filter by trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} placeholder="Any coach" options={trainers} />
      </div>

      {classes.isError ? (
        <ErrorState error={classes.error} onRetry={() => classes.refetch()} />
      ) : classes.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : dayClasses.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" />}
          title={`No classes ${day === days[0] ? 'left today' : 'on this day'}`}
          description={level || trainer ? 'Try clearing the filters, or pick another day.' : 'Pick another day from the strip above — or book a 1:1 session with a coach.'}
          action={
            level || trainer ? (
              <Button variant="secondary" onClick={() => (setLevel(''), setTrainer(''))}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink to="/member/personal-training" variant="secondary">
                Book personal training
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {dayClasses.map((c, i) => {
            const mineB = bookedByClass.get(c.id);
            const full = c.spotsLeft <= 0;
            const cancelled = c.status === 'cancelled';
            const pending = book.isPending && book.variables?.id === c.id;
            return (
              <motion.li key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={cn('card overflow-hidden', cancelled && 'opacity-60', mineB && 'border-primary/50')}>
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex items-center gap-4 sm:w-28 sm:flex-col sm:items-start sm:gap-0">
                    <p className="font-display text-2xl font-semibold tabular-nums leading-none">{fmtTime(c.startsAt)}</p>
                    <p className="flex items-center gap-1 text-xs text-muted sm:mt-1">
                      <Clock className="h-3 w-3" /> {Math.round((+new Date(c.endsAt) - +new Date(c.startsAt)) / 60000)} min
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{c.title}</h3>
                      <Badge>{titleCase(c.level)}</Badge>
                      {cancelled && <Badge tone="danger">Cancelled</Badge>}
                      {mineB && (
                        <Badge tone={mineB.status === 'waitlisted' ? 'warning' : 'success'}>
                          {mineB.status === 'waitlisted' ? <Hourglass className="h-3 w-3" /> : <Check className="h-3 w-3" />} {mineB.status === 'waitlisted' ? 'On waitlist' : 'Booked'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                      {c.trainer && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" /> {c.trainer.name}
                        </span>
                      )}
                      {c.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {c.location}
                        </span>
                      )}
                    </p>
                    {!cancelled && (
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={(c.capacity - c.spotsLeft) / c.capacity} tone={full ? 'warning' : 'primary'} className="max-w-[180px]" label="Class capacity" />
                        <span className={cn('inline-flex items-center gap-1 text-xs', full ? 'text-warning' : c.spotsLeft <= 3 ? 'text-warning' : 'text-muted')}>
                          <Users className="h-3.5 w-3.5" />
                          {full ? `Full${c.waitlistCount ? ` · ${c.waitlistCount} waiting` : ''}` : `${c.spotsLeft} of ${c.capacity} spots left`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="sm:w-40 sm:text-right">
                    {mineB ? (
                      <ButtonLink to="/member/bookings" variant="secondary" size="sm" className="w-full sm:w-auto">
                        Manage
                      </ButtonLink>
                    ) : cancelled ? null : (
                      <Button className="w-full sm:w-auto" variant={full ? 'secondary' : 'primary'} loading={pending} disabled={book.isPending || (full && site?.settings.bookings.allowWaitlist === false)} onClick={() => book.mutate(c)}>
                        {full ? (site?.settings.bookings.allowWaitlist === false ? 'Full' : 'Join waitlist') : 'Book spot'}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
