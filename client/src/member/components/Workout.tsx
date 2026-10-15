import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Dumbbell, Minus, Plus, Timer, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/format';
import type { PlanDay, WorkoutLog, WorkoutPlan } from './types';
import { toDateInput } from './utils';

const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s}s`);

/** Read-only plan days with exercises. */
export function PlanDays({ days, onLogDay }: { days: PlanDay[]; onLogDay?: (dayIndex: number) => void }) {
  const [active, setActive] = useState(0);
  if (!days.length) return <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="This plan has no training days yet" description="Your coach is still building it out." />;
  const day = days[Math.min(active, days.length - 1)];
  return (
    <div>
      <div role="tablist" aria-label="Training days" className="scrollbar-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn('shrink-0 rounded-2xl border px-4 py-2.5 text-left transition', i === active ? 'border-primary/50 bg-primary/10' : 'border-line hover:border-fg/20')}
          >
            <span className={cn('block text-sm font-semibold', i === active && 'text-primary')}>{d.name}</span>
            {d.focus && <span className="block text-xs text-muted">{d.focus}</span>}
          </button>
        ))}
      </div>
      <ol className="space-y-2.5">
        {day.exercises.map((ex, i) => (
          <motion.li key={`${active}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex gap-3 rounded-2xl border border-line/80 bg-fg/[0.02] p-3.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{ex.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="primary">
                  {ex.sets} × {ex.reps}
                </Badge>
                {ex.weightKg ? <Badge>{ex.weightKg} kg</Badge> : null}
                <Badge>
                  <Timer className="h-3 w-3" /> Rest {fmtRest(ex.restSec ?? 90)}
                </Badge>
                {ex.tempo ? <Badge>Tempo {ex.tempo}</Badge> : null}
              </div>
              {ex.notes && <p className="mt-1.5 text-xs text-muted">{ex.notes}</p>}
            </div>
          </motion.li>
        ))}
        {day.exercises.length === 0 && <li className="text-sm text-muted">No exercises on this day.</li>}
      </ol>
      {onLogDay && day.exercises.length > 0 && (
        <Button className="mt-4 w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={() => onLogDay(active)}>
          Log “{day.name}”
        </Button>
      )}
    </div>
  );
}

interface EntryDraft {
  name: string;
  sets: { reps: string; weightKg: string }[];
}

function draftFromDay(day?: PlanDay): EntryDraft[] {
  if (!day) return [{ name: '', sets: [{ reps: '', weightKg: '' }] }];
  return day.exercises.map((ex) => {
    const reps = String(parseInt(ex.reps, 10) || '');
    return { name: ex.name, sets: Array.from({ length: Math.max(1, ex.sets) }, () => ({ reps, weightKg: ex.weightKg ? String(ex.weightKg) : '' })) };
  });
}

/** Modal form to log a completed workout (optionally prefilled from a plan day). */
export function WorkoutLogForm({ open, onClose, memberPath, plans, initial, invalidate }: { open: boolean; onClose: () => void; memberPath: string; plans: WorkoutPlan[]; initial?: { planId: string; dayIndex: number } | null; invalidate: QueryKey[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [planId, setPlanId] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plan = plans.find((p) => p._id === planId);

  useEffect(() => {
    if (!open) return;
    const p = initial ? plans.find((x) => x._id === initial.planId) : undefined;
    setPlanId(p?._id ?? '');
    setDayIndex(initial?.dayIndex ?? 0);
    setEntries(draftFromDay(p?.days[initial?.dayIndex ?? 0]));
    setDate(toDateInput(new Date()));
    setDuration('');
    setNotes('');
    setErrors({});
  }, [open, initial, plans]);

  const choosePlanDay = (pid: string, di: number) => {
    setPlanId(pid);
    setDayIndex(di);
    const p = plans.find((x) => x._id === pid);
    setEntries(draftFromDay(p?.days[di]));
  };

  const update = (i: number, fn: (e: EntryDraft) => EntryDraft) => setEntries((xs) => xs.map((x, j) => (j === i ? fn(x) : x)));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        plan: planId || null,
        dayName: plan?.days[dayIndex]?.name ?? '',
        performedAt: new Date(`${date}T${date === toDateInput(new Date()) ? new Date().toTimeString().slice(0, 5) : '12:00'}`).toISOString(),
        durationMin: duration ? Math.round(Number(duration)) : undefined,
        entries: entries
          .filter((e) => e.name.trim())
          .map((e) => ({ name: e.name.trim(), sets: e.sets.filter((s) => s.reps !== '').map((s) => ({ reps: Math.round(Number(s.reps)), weightKg: s.weightKg === '' ? 0 : Number(s.weightKg) })) })),
        notes,
      };
      return api.post(`${memberPath}/workout-logs`, payload);
    },
    onSuccess: async () => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      toast.success('Workout logged', 'Another one in the bank.');
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      toast.error(err);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!date) errs.performedAt = 'Choose a date';
    else if (date > toDateInput(new Date())) errs.performedAt = 'Date can’t be in the future';
    if (duration && (Number(duration) < 0 || Number(duration) > 600)) errs.durationMin = 'Duration must be 0–600 minutes';
    if (!entries.some((x) => x.name.trim()) && !notes.trim()) errs.entries = 'Add at least one exercise (or a note)';
    entries.forEach((x, i) => x.sets.forEach((s, j) => {
      if (s.reps !== '' && (Number(s.reps) < 0 || Number(s.reps) > 500)) errs[`entries.${i}.sets.${j}.reps`] = 'Reps 0–500';
      if (s.weightKg !== '' && (Number(s.weightKg) < 0 || Number(s.weightKg) > 1000)) errs[`entries.${i}.sets.${j}.weightKg`] = 'Weight 0–1000';
    }));
    setErrors(errs);
    if (Object.keys(errs).length === 0) save.mutate();
  };

  const planOptions = useMemo(() => plans.flatMap((p) => p.days.map((d, i) => ({ value: `${p._id}:${i}`, label: `${p.title} — ${d.name}${d.focus ? ` (${d.focus})` : ''}` }))), [plans]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Log a workout"
      description="Record what you actually did — sets, reps and load. Your coach sees this history."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="log-form" loading={save.isPending}>
            Save workout
          </Button>
        </>
      }
    >
      <form id="log-form" onSubmit={submit} noValidate className="space-y-4">
        {planOptions.length > 0 && (
          <Select
            label="From plan (prefills exercises)"
            value={planId ? `${planId}:${dayIndex}` : ''}
            onChange={(e) => {
              const [pid, di] = e.target.value.split(':');
              if (!pid) {
                setPlanId('');
                setEntries(draftFromDay());
              } else choosePlanDay(pid, Number(di));
            }}
            placeholder="Free session (no plan)"
            options={planOptions}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Date" type="date" value={date} max={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} error={errors.performedAt} required />
          <Input label="Duration (minutes)" type="number" inputMode="numeric" min={0} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} error={errors.durationMin} />
        </div>
        <div className="space-y-3">
          {entries.map((en, i) => (
            <div key={i} className="rounded-2xl border border-line p-3">
              <div className="flex items-end gap-2">
                <Input wrapClassName="flex-1" label={`Exercise ${i + 1}`} value={en.name} onChange={(e) => update(i, (x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Back Squat" maxLength={100} />
                <Button variant="ghost" size="sm" className="mb-1 h-9 w-9 !p-0 text-danger" aria-label={`Remove exercise ${i + 1}`} onClick={() => setEntries((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {en.sets.map((s, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="mt-2.5 w-12 shrink-0 text-xs text-muted">Set {j + 1}</span>
                    <Input aria-label={`Exercise ${i + 1} set ${j + 1} reps`} wrapClassName="flex-1" type="number" inputMode="numeric" placeholder="Reps" value={s.reps} onChange={(e) => update(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === j ? { ...y, reps: e.target.value } : y)) }))} error={errors[`entries.${i}.sets.${j}.reps`]} />
                    <Input aria-label={`Exercise ${i + 1} set ${j + 1} weight in kg`} wrapClassName="flex-1" type="number" inputMode="decimal" step="0.5" placeholder="kg" value={s.weightKg} onChange={(e) => update(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === j ? { ...y, weightKg: e.target.value } : y)) }))} error={errors[`entries.${i}.sets.${j}.weightKg`]} />
                  </div>
                ))}
                <div className="flex gap-2 pl-14">
                  <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} disabled={en.sets.length >= 20} onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { reps: '', weightKg: '' }) }] }))}>
                    Set
                  </Button>
                  {en.sets.length > 1 && (
                    <Button variant="ghost" size="sm" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => update(i, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>
                      Set
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {errors.entries && (
            <p role="alert" className="text-xs text-danger">
              {errors.entries}
            </p>
          )}
          <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} disabled={entries.length >= 40} onClick={() => setEntries((xs) => [...xs, { name: '', sets: [{ reps: '', weightKg: '' }] }])}>
            Add exercise
          </Button>
        </div>
        <Textarea label="Notes" rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Energy, PRs, anything that felt off…" />
      </form>
    </Modal>
  );
}

/** Training history list. */
export function WorkoutLogList({ logs, empty }: { logs: WorkoutLog[]; empty?: React.ReactNode }) {
  if (!logs.length) return <>{empty}</>;
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
      {logs.map((l, i) => {
        const volume = l.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.reps * (s.weightKg || 0), 0), 0);
        const sets = l.entries.reduce((a, e) => a + e.sets.length, 0);
        return (
          <motion.li key={l._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="relative pl-10">
            <span className="absolute left-2 top-4 h-4 w-4 rounded-full border-2 border-primary bg-bg" aria-hidden />
            <div className="rounded-2xl border border-line bg-fg/[0.02] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{l.dayName || 'Workout'}</p>
                <p className="text-xs text-muted">
                  {fmtDate(l.performedAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtTime(l.performedAt)}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {l.durationMin ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {l.durationMin} min
                  </span>
                ) : null}
                <span>{sets} sets</span>
                {volume > 0 && <span>{Math.round(volume).toLocaleString('en-IN')} kg volume</span>}
              </div>
              {l.entries.length > 0 && (
                <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                  {l.entries.map((e, j) => (
                    <li key={j} className="flex justify-between gap-3 rounded-lg bg-fg/[0.03] px-3 py-1.5">
                      <span className="truncate">{e.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{e.sets.map((s) => (s.weightKg ? `${s.reps}×${s.weightKg}` : s.reps)).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              {l.notes && <p className="mt-2 text-sm text-muted">“{l.notes}”</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
