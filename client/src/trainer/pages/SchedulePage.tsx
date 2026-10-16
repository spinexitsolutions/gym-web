import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Check, ChevronDown, MapPin, UserRound, UserX, Users, X } from 'lucide-react';
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, titleCase } from '@/lib/format';
import type { Booking } from '@/types/api';
import { ProgressBar } from '@/member/components/ProgressRing';
import type { GymClassDoc, Ref } from '@/member/components/types';
import { dayKey } from '@/member/components/utils';

type Session = Omit<Booking, 'user'> & { user?: Ref | null };
interface Schedule {
  classes: GymClassDoc[];
  sessions: Session[];
}
type Item = { kind: 'class'; at: string; c: GymClassDoc } | { kind: 'session'; at: string; s: Session };

const canMark = (startsAt: string) => new Date(startsAt).getTime() <= Date.now() + 30 * 60000;

export default function TrainerSchedulePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'classes' | 'sessions'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Session | null>(null);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['trainer', 'schedule'], queryFn: () => api.get<Schedule>('/trainers/me/schedule', { days: 14 }) });

  const groups = useMemo(() => {
    const items: Item[] = [
      ...(filter !== 'sessions' ? (q.data?.classes ?? []).map((c) => ({ kind: 'class' as const, at: c.startsAt, c })) : []),
      ...(filter !== 'classes' ? (q.data?.sessions ?? []).map((s) => ({ kind: 'session' as const, at: s.startsAt, s })) : []),
    ].sort((a, b) => +new Date(a.at) - +new Date(b.at));
    const m = new Map<string, Item[]>();
    items.forEach((it) => {
      const k = dayKey(it.at);
      m.set(k, [...(m.get(k) ?? []), it]);
    });
    return [...m];
  }, [q.data, filter]);

  const mark = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'attended' | 'no_show' }) => api.post(`/bookings/${id}/attendance`, { status }),
    onSuccess: (_, v) => {
      toast.success(v.status === 'attended' ? 'Marked attended' : 'Marked no-show');
      void qc.invalidateQueries({ queryKey: ['trainer'] });
    },
    onError: (e) => toast.error(e),
  });
  const cancel = useMutation({
    mutationFn: (s: Session) => api.post(`/bookings/${s._id}/cancel`, { reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success('Session cancelled', 'The member has been notified.');
      setCancelling(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['trainer'] });
    },
    onError: (e) => toast.error(e),
  });
  const today = dayKey(new Date());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Coaching" title="Schedule & attendance" description="Your classes and 1:1 sessions for the next two weeks. Attendance can be marked from 30 minutes before the start." />
      <Tabs
        className="mb-5 w-fit"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'Everything' },
          { value: 'classes', label: 'Classes', count: q.data?.classes.length },
          { value: 'sessions', label: '1:1 sessions', count: q.data?.sessions.length },
        ]}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !groups.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" description="No classes or sessions in the next two weeks." />
      ) : (
        <div className="space-y-6">
          {groups.map(([k, items]) => (
            <section key={k}>
              <h2 className={cn('sticky top-16 z-10 -mx-1 mb-2 bg-bg/90 px-1 py-1.5 text-sm font-semibold backdrop-blur', k === today && 'text-primary')}>
                {k === today ? 'Today · ' : ''}
                {fmtDate(`${k}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <ul className="space-y-2.5">
                {items.map((it) =>
                  it.kind === 'class' ? (
                    <li key={it.c._id} className={cn('card overflow-hidden', it.c.status === 'cancelled' && 'opacity-60')}>
                      <button className="flex w-full items-center gap-4 p-4 text-left" aria-expanded={open === it.c._id} onClick={() => setOpen(open === it.c._id ? null : it.c._id)} disabled={it.c.status === 'cancelled'}>
                        <div className="w-20 shrink-0">
                          <p className="whitespace-nowrap font-display text-lg font-semibold tabular-nums">{fmtTime(it.c.startsAt)}</p>
                          <p className="text-xs text-muted">{Math.round((+new Date(it.c.endsAt) - +new Date(it.c.startsAt)) / 60000)} min</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{it.c.title}</p>
                            <Badge tone="primary">Class</Badge>
                            {it.c.status !== 'scheduled' && <StatusBadge status={it.c.status} />}
                          </div>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                            {it.c.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {it.c.location}
                              </span>
                            )}
                            <span>{titleCase(it.c.level)}</span>
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <ProgressBar value={it.c.bookedCount / it.c.capacity} className="max-w-[160px]" label="Booked" />
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <Users className="h-3.5 w-3.5" /> {it.c.bookedCount}/{it.c.capacity}
                              {it.c.waitlistCount ? ` · ${it.c.waitlistCount} waiting` : ''}
                            </span>
                          </div>
                        </div>
                        {it.c.status === 'scheduled' && <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', open === it.c._id && 'rotate-180')} />}
                      </button>
                      <AnimatePresence>{open === it.c._id && <Roster classId={it.c._id} startsAt={it.c.startsAt} onMark={(id, status) => mark.mutate({ id, status })} marking={mark.isPending ? mark.variables?.id : undefined} />}</AnimatePresence>
                    </li>
                  ) : (
                    <li key={it.s._id} className="card flex flex-wrap items-center gap-4 p-4">
                      <div className="w-20 shrink-0">
                        <p className="whitespace-nowrap font-display text-lg font-semibold tabular-nums">{fmtTime(it.s.startsAt)}</p>
                        <p className="text-xs text-muted">{Math.round((+new Date(it.s.endsAt) - +new Date(it.s.startsAt)) / 60000)} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{it.s.user?.name ?? it.s.guest?.name ?? 'Guest'}</p>
                          <Badge tone={it.s.type === 'trial' ? 'info' : 'success'}>{it.s.type === 'trial' ? 'Trial' : 'Personal training'}</Badge>
                          <StatusBadge status={it.s.status} />
                        </div>
                        <p className="text-xs text-muted">{it.s.user?.phone || it.s.guest?.phone || it.s.user?.email || ''}</p>
                        {it.s.notes && <p className="mt-1 text-xs text-muted">“{it.s.notes}”</p>}
                      </div>
                      {it.s.active && (
                        <div className="flex gap-1.5">
                          {it.s.status === 'confirmed' && canMark(it.s.startsAt) && (
                            <>
                              <Button size="sm" variant="secondary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => mark.mutate({ id: it.s._id, status: 'attended' })}>
                                Attended
                              </Button>
                              <Button size="sm" variant="ghost" icon={<UserX className="h-3.5 w-3.5" />} onClick={() => mark.mutate({ id: it.s._id, status: 'no_show' })}>
                                No-show
                              </Button>
                            </>
                          )}
                          {new Date(it.s.startsAt) > new Date() && (
                            <Button size="sm" variant="ghost" className="text-danger" icon={<X className="h-3.5 w-3.5" />} onClick={() => setCancelling(it.s)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        loading={cancel.isPending}
        tone="danger"
        title="Cancel this session?"
        confirmLabel="Cancel session"
        description={cancelling ? `${cancelling.user?.name ?? 'Guest'} · ${fmtDate(cancelling.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} ${fmtTime(cancelling.startsAt)}` : undefined}
      >
        <Textarea label="Reason (shared with the member)" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I’m unwell — let’s rebook for Thursday." />
      </ConfirmDialog>
    </div>
  );
}

function Roster({ classId, startsAt, onMark, marking }: { classId: string; startsAt: string; onMark: (id: string, s: 'attended' | 'no_show') => void; marking?: string }) {
  const q = useQuery({ queryKey: ['trainer', 'roster', classId], queryFn: () => api.get<{ bookings: (Omit<Booking, 'user'> & { user?: Ref })[] }>(`/classes/${classId}/roster`) });
  const markable = canMark(startsAt);
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line/70">
      <div className="p-4">
        {!markable && <p className="mb-3 text-xs text-muted">Attendance opens 30 minutes before the class starts.</p>}
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <Skeleton className="h-20" />
        ) : !q.data?.bookings.length ? (
          <p className="text-sm text-muted">No one has booked yet.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.bookings.map((b) => (
              <li key={b._id} className="flex flex-wrap items-center gap-3 rounded-xl bg-fg/[0.03] px-3 py-2">
                <Avatar name={b.user?.name ?? '?'} src={b.user?.avatarUrl || undefined} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.user?.name ?? 'Member'}</p>
                  <p className="truncate text-xs text-muted">{b.user?.phone || b.user?.email}</p>
                </div>
                <StatusBadge status={b.status} />
                {markable && ['confirmed', 'attended', 'no_show'].includes(b.status) && (
                  <div className="flex gap-1">
                    <Button size="sm" variant={b.status === 'attended' ? 'primary' : 'secondary'} loading={marking === b._id} aria-label={`Mark ${b.user?.name} attended`} icon={<Check className="h-3.5 w-3.5" />} onClick={() => onMark(b._id, 'attended')}>
                      <span className="hidden sm:inline">Attended</span>
                    </Button>
                    <Button size="sm" variant={b.status === 'no_show' ? 'danger' : 'ghost'} aria-label={`Mark ${b.user?.name} no-show`} icon={<UserRound className="h-3.5 w-3.5" />} onClick={() => onMark(b._id, 'no_show')}>
                      <span className="hidden sm:inline">No-show</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
