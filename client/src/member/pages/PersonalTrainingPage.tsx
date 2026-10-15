import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, CalendarX2, Clock, UserRound } from 'lucide-react';
import { Alert, Avatar, Badge, Button, ButtonLink, Card, CardBody, EmptyState, ErrorState, PageHeader, Skeleton, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Booking, TrainerPublic } from '@/types/api';
import { todayKey } from '../components/utils';

export default function PersonalTrainingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const trainerId = params.get('trainer') ?? '';
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => todayKey(i)), []);
  const [date, setDate] = useState(days[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [blocker, setBlocker] = useState<ApiError | null>(null);
  const [booked, setBooked] = useState<Booking | null>(null);

  const trainers = useQuery({ queryKey: ['public', 'trainers'], queryFn: () => api.get<TrainerPublic[]>('/trainers', { limit: 50 }) });
  const trainer = trainers.data?.find((t) => t.id === trainerId);
  const slots = useQuery({
    queryKey: ['member', 'pt-slots', trainerId, date],
    queryFn: () => api.get<{ minutes: number; slots: string[] }>('/bookings/pt/slots', { trainerId, date }),
    enabled: Boolean(trainerId && date),
  });

  useEffect(() => setSlot(null), [trainerId, date]);

  const book = useMutation({
    mutationFn: () => api.post<Booking>('/bookings/pt', { trainerId, startsAt: slot, notes: notes.trim() || undefined }),
    onSuccess: (b) => {
      setBooked(b);
      setBlocker(null);
      setNotes('');
      setSlot(null);
      void qc.invalidateQueries({ queryKey: ['member'] });
      toast.success('Session booked', `${trainer?.displayName ?? 'Your coach'} has been notified.`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'MEMBERSHIP_REQUIRED') setBlocker(err);
      else toast.error(err);
      void slots.refetch();
    },
  });

  const pickTrainer = (id: string) => {
    setBooked(null);
    setParams(id ? { trainer: id } : {}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Training" title="Personal training" description="One-to-one coaching built around your goals. Pick a coach, a day and a time that suits you." />

      {blocker && (
        <Alert tone="warning" title="Membership required" className="mb-4">
          <p>{blocker.message}</p>
          <ButtonLink to="/member/membership#plans" size="sm" className="mt-2">
            View plans
          </ButtonLink>
        </Alert>
      )}

      <AnimatePresence>
        {booked && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5">
            <Alert tone="success" title="You’re booked!">
              {fmtDate(booked.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} at {fmtTime(booked.startsAt)} with {trainer?.displayName}. You can manage it from{' '}
              <Link to="/member/bookings" className="font-medium text-primary underline-offset-2 hover:underline">
                My bookings
              </Link>
              .
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">1 · Choose your coach</h2>
      {trainers.isError ? (
        <ErrorState error={trainers.error} onRetry={() => trainers.refetch()} />
      ) : trainers.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !trainers.data?.length ? (
        <EmptyState icon={<UserRound className="h-5 w-5" />} title="No coaches available for booking" description="Please check back soon or ask at the front desk." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Coach">
          {trainers.data.map((t) => {
            const selected = t.id === trainerId;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={selected}
                onClick={() => pickTrainer(t.id)}
                className={cn('card flex items-start gap-3 p-4 text-left transition', selected ? 'border-primary shadow-glow' : 'hover:border-fg/25')}
              >
                <Avatar name={t.displayName} src={t.photoUrl || undefined} size={52} />
                <div className="min-w-0">
                  <p className="font-semibold">{t.displayName}</p>
                  {t.title && <p className="text-xs text-primary">{t.title}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.specializations.slice(0, 3).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3 w-3" /> {t.ptSessionMinutes ?? 60}-min sessions{t.experienceYears ? ` · ${t.experienceYears} yrs experience` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {trainerId && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted">2 · Pick a day</h2>
          <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" role="tablist" aria-label="Day">
            {days.map((k) => {
              const d = new Date(`${k}T12:00:00`);
              const sel = k === date;
              return (
                <button key={k} role="tab" aria-selected={sel} onClick={() => setDate(k)} className={cn('flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 transition', sel ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface hover:border-fg/25')}>
                  <span className={cn('text-[0.62rem] font-semibold uppercase', sel ? 'text-on-primary/80' : 'text-muted')}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                  <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                  <span className={cn('text-[0.6rem] uppercase', sel ? 'text-on-primary/70' : 'text-muted')}>{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-muted">3 · Choose a time</h2>
          <Card>
            <CardBody>
              {slots.isError ? (
                <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
              ) : slots.isLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11" />
                  ))}
                </div>
              ) : !slots.data?.slots.length ? (
                <EmptyState icon={<CalendarX2 className="h-5 w-5" />} title="No open slots on this day" description={`${trainer?.displayName ?? 'This coach'} is fully booked or not working this day. Try another date.`} className="border-0 py-8" />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6" role="radiogroup" aria-label="Time slot">
                    {slots.data.slots.map((s) => (
                      <button
                        key={s}
                        role="radio"
                        aria-checked={slot === s}
                        onClick={() => setSlot(s)}
                        className={cn('rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums transition', slot === s ? 'border-primary bg-primary/15 text-primary' : 'border-line hover:border-fg/30')}
                      >
                        {fmtTime(s)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">{slots.data.minutes}-minute session · times shown in the gym’s local time.</p>
                </>
              )}
              <AnimatePresence>
                {slot && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-5 space-y-4 border-t border-line/70 pt-5">
                      <Textarea label="Anything your coach should know? (optional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals for the session, injuries, equipment preferences…" />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm">
                          <span className="text-muted">Booking </span>
                          <span className="font-semibold">
                            {fmtDate(slot, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(slot)}
                          </span>
                          <span className="text-muted"> with {trainer?.displayName}</span>
                        </p>
                        <Button icon={<CalendarCheck className="h-4 w-4" />} loading={book.isPending} onClick={() => book.mutate()}>
                          Confirm booking
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
