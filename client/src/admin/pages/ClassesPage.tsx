import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ban, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ClipboardList, LayoutGrid, List, MapPin, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, StatusBadge, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, titleCase } from '@/lib/format';
import type { ClassItem } from '@/types/api';
import { CapacityBar } from '../components/Bits';
import { ReasonDialog } from '../components/ReasonDialog';
import { trainerOptions, usePrograms, useTrainersAdmin } from '../components/queries';
import type { RosterResponse } from '../components/types';
import { addDaysLocal, applyApiErrors, combineDateTime, startOfWeek, toDateInput, toTimeInput } from '../components/utils';

type ClassRow = ClassItem & { program?: { _id?: string; title: string; slug: string } | null };
const booked = (c: ClassItem) => Math.max(0, c.capacity - c.spotsLeft);

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const;
const schema = z.object({
  title: z.string().trim().min(2, 'At least 2 characters').max(100),
  description: z.string().trim().max(1000),
  program: z.string(),
  trainer: z.string(),
  date: z.string().min(1, 'Choose a date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time'),
  durationMin: z.number({ invalid_type_error: 'Enter minutes' }).int().min(15, 'At least 15 minutes').max(300, 'At most 300 minutes'),
  capacity: z.number({ invalid_type_error: 'Enter a number' }).int().min(1, 'At least 1').max(500),
  location: z.string().trim().max(80),
  level: z.enum(LEVELS),
  repeatWeeks: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(26),
});
type Form = z.infer<typeof schema>;

function ClassFormModal({ open, onClose, cls, defaultDate }: { open: boolean; onClose: () => void; cls: ClassRow | null; defaultDate?: Date }) {
  const qc = useQueryClient();
  const toast = useToast();
  const trainers = useTrainersAdmin(open);
  const programs = usePrograms(open);
  const { register, handleSubmit, reset, setError, watch, formState } = useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!open) return;
    if (cls)
      reset({
        title: cls.title,
        description: cls.description ?? '',
        program: cls.program?._id ?? '',
        trainer: cls.trainer?.id ?? '',
        date: toDateInput(cls.startsAt),
        time: toTimeInput(cls.startsAt),
        durationMin: Math.round((new Date(cls.endsAt).getTime() - new Date(cls.startsAt).getTime()) / 60000),
        capacity: cls.capacity,
        location: cls.location ?? '',
        level: (cls.level as Form['level']) ?? 'all',
        repeatWeeks: 0,
      });
    else {
      const d = defaultDate && defaultDate > new Date() ? defaultDate : addDaysLocal(new Date(), 1);
      reset({ title: '', description: '', program: '', trainer: '', date: toDateInput(d), time: '07:00', durationMin: 60, capacity: 12, location: '', level: 'all', repeatWeeks: 0 });
    }
  }, [open, cls, defaultDate, reset]);

  const m = useMutation({
    mutationFn: (f: Form) => {
      const startsAt = combineDateTime(f.date, f.time);
      const common = { title: f.title, description: f.description, trainer: f.trainer || null, startsAt, durationMin: f.durationMin, capacity: f.capacity, location: f.location, level: f.level };
      return cls ? api.patch(`/classes/${cls.id}`, common) : api.post<unknown[]>('/classes', { ...common, program: f.program || null, repeatWeeks: f.repeatWeeks });
    },
    onSuccess: (r) => {
      toast.success(cls ? 'Class updated' : Array.isArray(r) && r.length > 1 ? `${r.length} sessions created` : 'Class created', cls ? 'Booked members keep their spot at the new time.' : undefined);
      void qc.invalidateQueries({ queryKey: ['admin', 'classes'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setError('time', { message: err.message });
      else if (!applyApiErrors(err, setError, { startsAt: 'date' })) toast.error(err);
    },
  });
  const e = formState.errors;
  const num = { valueAsNumber: true } as const;
  const repeat = watch('repeatWeeks');
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={cls ? 'Edit class' : 'Create class'}
      description={cls ? `${cls.title} · ${fmtDate(cls.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} ${fmtTime(cls.startsAt)}` : 'Schedule a single session or a weekly series.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" loading={m.isPending}>
            {cls ? 'Save changes' : repeat > 0 ? `Create ${repeat + 1} sessions` : 'Create class'}
          </Button>
        </>
      }
    >
      <form id="class-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Input label="Title" required wrapClassName="sm:col-span-2" error={e.title?.message} {...register('title')} />
        <Textarea label="Description" rows={2} wrapClassName="sm:col-span-2" maxLength={1000} error={e.description?.message} {...register('description')} />
        <Select
          label="Program"
          placeholder={programs.isLoading ? 'Loading…' : 'None'}
          disabled={Boolean(cls)}
          hint={cls ? 'The program can’t be changed after creation.' : programs.isError ? 'Programs unavailable (needs website content access).' : undefined}
          options={(programs.data ?? []).map((p) => ({ value: p._id, label: p.title }))}
          {...register('program')}
        />
        <Select label="Trainer" placeholder={trainers.isLoading ? 'Loading…' : 'Unassigned'} options={trainerOptions(trainers.data)} error={e.trainer?.message} {...register('trainer')} />
        <Input type="date" label="Date" required min={cls ? undefined : toDateInput(new Date())} error={e.date?.message} {...register('date')} />
        <Input type="time" label="Start time" required step={300} error={e.time?.message} {...register('time')} />
        <Input type="number" label="Duration (minutes)" required min={15} max={300} step={5} error={e.durationMin?.message} {...register('durationMin', num)} />
        <Input type="number" label="Capacity" required min={1} max={500} error={e.capacity?.message} hint={cls && booked(cls) ? `Can’t go below ${booked(cls)} booked.` : undefined} {...register('capacity', num)} />
        <Input label="Location" placeholder="e.g. Studio" maxLength={80} error={e.location?.message} {...register('location')} />
        <Select label="Level" options={LEVELS.map((l) => ({ value: l, label: titleCase(l) }))} {...register('level')} />
        {!cls && <Input type="number" label="Repeat weekly" min={0} max={26} hint="Additional weekly sessions (0 = one-off, max 26)." error={e.repeatWeeks?.message} {...register('repeatWeeks', num)} />}
      </form>
    </Modal>
  );
}

function RosterModal({ cls, onClose }: { cls: ClassRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'classes', 'roster', cls?.id], queryFn: () => api.get<RosterResponse>(`/classes/${cls!.id}/roster`), enabled: Boolean(cls) });
  const mark = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'attended' | 'no_show' }) => api.post(`/bookings/${id}/attendance`, { status }),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'attended' ? 'Marked attended' : 'Marked no-show');
      void qc.invalidateQueries({ queryKey: ['admin', 'classes', 'roster', cls?.id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (err) => toast.error(err),
  });
  const tooEarly = cls ? new Date(cls.startsAt).getTime() > Date.now() + 30 * 60000 : false;
  const confirmed = (q.data?.bookings ?? []).filter((b) => b.status !== 'waitlisted');
  const waitlist = (q.data?.bookings ?? []).filter((b) => b.status === 'waitlisted');
  return (
    <Modal open={Boolean(cls)} onClose={onClose} size="lg" title={cls ? `Roster · ${cls.title}` : 'Roster'} description={cls ? `${fmtDate(cls.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })} · ${fmtTime(cls.startsAt)}–${fmtTime(cls.endsAt)}${cls.location ? ` · ${cls.location}` : ''}` : undefined}>
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {tooEarly && <Alert tone="info">Attendance can be marked from 30 minutes before the start time.</Alert>}
          <section>
            <h3 className="eyebrow mb-2">
              Booked · {confirmed.length}/{cls?.capacity}
            </h3>
            {confirmed.length === 0 ? (
              <p className="rounded-theme-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-line/70 rounded-theme-sm border border-line">
                {confirmed.map((b) => (
                  <li key={b._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Avatar name={b.user?.name ?? '?'} src={b.user?.avatarUrl || undefined} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.user?.name ?? 'Unknown'}</p>
                      <p className="truncate text-xs text-muted">{b.user?.phone || b.user?.email}</p>
                    </div>
                    <StatusBadge status={b.status} />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={b.status === 'attended' ? 'primary' : 'secondary'}
                        disabled={tooEarly || mark.isPending || b.status === 'attended'}
                        icon={<UserCheck className="h-3.5 w-3.5" />}
                        onClick={() => mark.mutate({ id: b._id, status: 'attended' })}
                      >
                        Attended
                      </Button>
                      <Button size="sm" variant="ghost" className={cn(b.status !== 'no_show' && 'text-danger')} disabled={tooEarly || mark.isPending || b.status === 'no_show'} icon={<UserX className="h-3.5 w-3.5" />} onClick={() => mark.mutate({ id: b._id, status: 'no_show' })}>
                        No-show
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {waitlist.length > 0 && (
            <section>
              <h3 className="eyebrow mb-2">Waitlist · {waitlist.length}</h3>
              <ol className="divide-y divide-line/70 rounded-theme-sm border border-line">
                {waitlist.map((b, i) => (
                  <li key={b._id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-5 text-xs tabular-nums text-muted">{i + 1}</span>
                    <span className="flex-1 truncate">{b.user?.name ?? 'Unknown'}</span>
                    <span className="text-xs text-muted">{b.user?.email}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-xs text-muted">Waitlisted members are promoted automatically when a spot opens.</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function ClassCard({ c, onEdit, onCancel, onDelete, onRoster, dense }: { c: ClassRow; onEdit: () => void; onCancel: () => void; onDelete: () => void; onRoster: () => void; dense?: boolean }) {
  const cancelled = c.status === 'cancelled';
  const past = new Date(c.endsAt) < new Date();
  const b = booked(c);
  return (
    <div className={cn('group rounded-theme-sm border border-line bg-surface-2/60 p-3 transition hover:border-primary/40', cancelled && 'opacity-60', past && !cancelled && 'opacity-80')}>
      <button type="button" onClick={onRoster} className="block w-full text-left focus-visible:outline-none" aria-label={`Open roster for ${c.title} at ${fmtTime(c.startsAt)}`}>
        <p className="text-xs font-medium tabular-nums text-primary">
          {fmtTime(c.startsAt)}–{fmtTime(c.endsAt)}
        </p>
        <p className={cn('mt-0.5 font-medium leading-tight', dense ? 'text-sm' : 'text-base', cancelled && 'line-through')}>{c.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{c.trainer?.name ?? 'No trainer'}</p>
        {c.location && (
          <p className="truncate text-xs text-muted">
            <MapPin className="mr-0.5 inline h-3 w-3" />
            {c.location}
          </p>
        )}
      </button>
      {cancelled ? (
        <Badge tone="danger" className="mt-2">
          cancelled
        </Badge>
      ) : (
        <CapacityBar className="mt-2" booked={b} capacity={c.capacity} waitlist={c.waitlistCount} />
      )}
      {!cancelled && (
        <div className="mt-2 flex gap-0.5 opacity-100 transition lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
          <Button size="sm" variant="ghost" className="!px-1.5" aria-label="Roster" onClick={onRoster}>
            <ClipboardList className="h-3.5 w-3.5" />
          </Button>
          {!past && (
            <>
              <Button size="sm" variant="ghost" className="!px-1.5" aria-label="Edit class" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="!px-1.5 text-warning" aria-label="Cancel class" onClick={onCancel}>
                <Ban className="h-3.5 w-3.5" />
              </Button>
              {b === 0 && c.waitlistCount === 0 && (
                <Button size="sm" variant="ghost" className="!px-1.5 text-danger" aria-label="Delete class" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [layout, setLayout] = useState<'week' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'list' : 'week'));
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [cancelling, setCancelling] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<ClassRow | null>(null);
  useEffect(() => {
    if (params.get('new')) setParams({}, { replace: true });
  }, [params, setParams]);

  const q = useQuery({
    queryKey: ['admin', 'classes', 'week', weekStart.toISOString()],
    queryFn: () => api.get<ClassRow[]>('/classes', { from: weekStart.toISOString(), days: 7, limit: 200 }),
    placeholderData: keepPreviousData,
  });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => days.map((d) => (q.data ?? []).filter((c) => toDateInput(c.startsAt) === toDateInput(d))), [days, q.data]);
  const totals = useMemo(() => {
    const live = (q.data ?? []).filter((c) => c.status !== 'cancelled');
    const cap = live.reduce((s, c) => s + c.capacity, 0);
    const bk = live.reduce((s, c) => s + booked(c), 0);
    return { sessions: live.length, cancelled: (q.data ?? []).length - live.length, fill: cap ? Math.round((bk / cap) * 100) : 0, waitlist: live.reduce((s, c) => s + c.waitlistCount, 0) };
  }, [q.data]);

  const cancelM = useMutation({
    mutationFn: ({ c, reason }: { c: ClassRow; reason: string }) => api.post<{ affected: number }>(`/classes/${c.id}/cancel`, { reason }),
    onSuccess: (r) => {
      toast.success('Class cancelled', `${r.affected} booked member(s) were notified.`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setCancelling(null);
    },
    onError: (err) => toast.error(err),
  });
  const deleteM = useMutation({
    mutationFn: (c: ClassRow) => api.delete(`/classes/${c.id}`),
    onSuccess: () => {
      toast.success('Class deleted');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setDeleting(null);
    },
    onError: (err) => {
      toast.error(err);
      setDeleting(null);
    },
  });

  const openCreate = (d?: Date) => {
    setEditing(null);
    setDefaultDate(d);
    setFormOpen(true);
  };
  const cardProps = (c: ClassRow) => ({
    c,
    onEdit: () => {
      setEditing(c);
      setFormOpen(true);
    },
    onCancel: () => setCancelling(c),
    onDelete: () => setDeleting(c),
    onRoster: () => setRoster(c),
  });
  const thisWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();
  const todayKey = toDateInput(new Date());

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Classes"
        description="Weekly schedule, capacity and rosters."
        actions={
          <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => openCreate()}>
            Create class
          </Button>
        }
      />
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" aria-label="Previous week" onClick={() => setWeekStart(addDaysLocal(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" aria-label="Next week" onClick={() => setWeekStart(addDaysLocal(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="ml-1 font-display text-sm font-semibold tabular-nums sm:text-base" aria-live="polite">
            {fmtDate(weekStart, { day: 'numeric', month: 'short' })} – {fmtDate(addDaysLocal(weekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {!thisWeek && (
            <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Today
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span>
            <strong className="text-fg tabular-nums">{totals.sessions}</strong> sessions
          </span>
          <span>
            <strong className="text-fg tabular-nums">{totals.fill}%</strong> booked
          </span>
          {totals.waitlist > 0 && (
            <span>
              <strong className="text-warning tabular-nums">{totals.waitlist}</strong> waitlisted
            </span>
          )}
          {totals.cancelled > 0 && <span>{totals.cancelled} cancelled</span>}
          <div className="flex rounded-full border border-line p-0.5" role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === 'week'} aria-label="Week grid" onClick={() => setLayout('week')} className={cn('rounded-full p-1.5', layout === 'week' ? 'bg-primary text-on-primary' : 'hover:text-fg')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-pressed={layout === 'list'} aria-label="List" onClick={() => setLayout('list')} className={cn('rounded-full p-1.5', layout === 'list' ? 'bg-primary text-on-primary' : 'hover:text-fg')}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No classes this week" description="Create a class or a weekly series. Members book from the website and their dashboard." action={<Button onClick={() => openCreate(weekStart)}>Create class</Button>} />
      ) : layout === 'week' ? (
        <div className="scrollbar-thin overflow-x-auto pb-2">
          <div className="grid min-w-[980px] grid-cols-7 gap-2">
            {days.map((d, i) => {
              const isToday = toDateInput(d) === todayKey;
              return (
                <section key={i} aria-label={fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })} className={cn('flex min-h-[18rem] flex-col rounded-theme border border-line bg-fg/[0.02] p-2', isToday && 'border-primary/50 bg-primary/[0.04]')}>
                  <header className="mb-2 flex items-baseline justify-between px-1">
                    <span className={cn('text-xs font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-muted')}>{fmtDate(d, { weekday: 'short' })}</span>
                    <span className={cn('font-display text-lg font-semibold tabular-nums', isToday && 'text-primary')}>{d.getDate()}</span>
                  </header>
                  <div className="flex-1 space-y-2">
                    {byDay[i].map((c) => (
                      <ClassCard key={c.id} dense {...cardProps(c)} />
                    ))}
                  </div>
                  {d >= new Date(new Date().setHours(0, 0, 0, 0)) && (
                    <button type="button" onClick={() => openCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7))} className="mt-2 rounded-theme-sm border border-dashed border-line py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-fg">
                      + Add
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d, i) =>
            byDay[i].length ? (
              <section key={i}>
                <h2 className={cn('mb-2 text-sm font-semibold', toDateInput(d) === todayKey ? 'text-primary' : 'text-muted')}>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {byDay[i].map((c) => (
                    <ClassCard key={c.id} {...cardProps(c)} />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}

      <ClassFormModal open={formOpen} onClose={() => setFormOpen(false)} cls={editing} defaultDate={defaultDate} />
      <RosterModal cls={roster} onClose={() => setRoster(null)} />
      <ReasonDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => cancelling && cancelM.mutate({ c: cancelling, reason })}
        loading={cancelM.isPending}
        tone="danger"
        title={`Cancel ${cancelling?.title ?? 'class'}?`}
        description={cancelling ? `${fmtDate(cancelling.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })} at ${fmtTime(cancelling.startsAt)}. All ${booked(cancelling)} booked and ${cancelling.waitlistCount} waitlisted members are notified.` : undefined}
        confirmLabel="Cancel class"
        placeholder="Shared with booked members, e.g. Coach unwell"
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteM.mutate(deleting)}
        loading={deleteM.isPending}
        tone="danger"
        title={`Delete ${deleting?.title ?? 'class'}?`}
        description="Permanently removes this session. Only possible while nobody has booked it — otherwise cancel it so members are notified."
        confirmLabel="Delete"
      />
    </div>
  );
}
