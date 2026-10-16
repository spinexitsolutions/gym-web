import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Dumbbell, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Modal, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { refId, type AssignedMember, type Exercise, type PlanDay, type PlanExercise, type WorkoutPlan } from '@/member/components/types';
import { toDateInput } from '@/member/components/utils';

export interface PlanDraft {
  title: string;
  description: string;
  member: string;
  isTemplate: boolean;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  days: PlanDay[];
}

export const emptyDraft = (member = ''): PlanDraft => ({ title: '', description: '', member, isTemplate: !member, startDate: '', endDate: '', status: 'active', days: [{ name: 'Day 1', focus: '', exercises: [] }] });

export const draftFromPlan = (p: WorkoutPlan, asCopy = false): PlanDraft => ({
  title: asCopy ? `${p.title}` : p.title,
  description: p.description ?? '',
  member: asCopy ? '' : refId(p.member as { _id: string } | string | null),
  isTemplate: asCopy ? false : p.isTemplate,
  startDate: asCopy ? '' : toDateInput(p.startDate),
  endDate: asCopy ? '' : toDateInput(p.endDate),
  status: asCopy ? 'active' : p.status,
  days: p.days.map((d) => ({ name: d.name, focus: d.focus ?? '', exercises: d.exercises.map((e) => ({ ...e, tempo: e.tempo ?? '', notes: e.notes ?? '' })) })),
});

const move = <T,>(xs: T[], i: number, d: -1 | 1) => {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** Converts a draft to the API body. */
export function draftToBody(d: PlanDraft) {
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    member: d.isTemplate ? null : d.member || null,
    isTemplate: d.isTemplate,
    startDate: d.startDate ? new Date(`${d.startDate}T00:00:00`).toISOString() : null,
    endDate: d.endDate ? new Date(`${d.endDate}T00:00:00`).toISOString() : null,
    status: d.status,
    days: d.days.map((day) => ({
      name: day.name.trim(),
      focus: (day.focus ?? '').trim(),
      exercises: day.exercises.map((e) => ({ exercise: e.exercise || null, name: e.name.trim(), sets: Number(e.sets), reps: String(e.reps).trim(), weightKg: e.weightKg === null || e.weightKg === undefined || (e.weightKg as unknown) === '' ? null : Number(e.weightKg), restSec: Number(e.restSec), tempo: (e.tempo ?? '').trim(), notes: (e.notes ?? '').trim() })),
    })),
  };
}

/** Client-side validation mirroring the server schema. Returns errors keyed like server paths. */
export function validateDraft(d: PlanDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.title.trim().length < 2) e.title = 'Title must be at least 2 characters';
  if (!d.isTemplate && !d.member) e.member = 'Choose a member, or save as a template';
  if (d.startDate && d.endDate && d.endDate < d.startDate) e.endDate = 'End date must be after start date';
  if (!d.days.length) e.days = 'Add at least one training day';
  d.days.forEach((day, i) => {
    if (!day.name.trim()) e[`days.${i}.name`] = 'Name this day';
    day.exercises.forEach((x, j) => {
      const p = `days.${i}.exercises.${j}`;
      if (!x.name.trim()) e[`${p}.name`] = 'Name required';
      if (!(Number(x.sets) >= 1 && Number(x.sets) <= 20)) e[`${p}.sets`] = '1–20';
      if (!String(x.reps).trim()) e[`${p}.reps`] = 'Required';
      if (!(Number(x.restSec) >= 0 && Number(x.restSec) <= 900)) e[`${p}.restSec`] = '0–900';
      if (x.weightKg != null && (x.weightKg as unknown) !== '' && !(Number(x.weightKg) >= 0 && Number(x.weightKg) <= 1000)) e[`${p}.weightKg`] = '0–1000';
    });
  });
  return e;
}

/** Workout plan editor: days → exercises with sets/reps/load/rest/tempo/notes and up/down reordering. */
export function PlanBuilder({ value, onChange, errors, members }: { value: PlanDraft; onChange: (d: PlanDraft) => void; errors: Record<string, string>; members: AssignedMember[] }) {
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const set = (patch: Partial<PlanDraft>) => onChange({ ...value, ...patch });
  const setDay = (i: number, patch: Partial<PlanDay>) => set({ days: value.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setEx = (i: number, j: number, patch: Partial<PlanExercise>) => setDay(i, { exercises: value.days[i].exercises.map((x, k) => (k === j ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Plan title" required wrapClassName="sm:col-span-2" maxLength={120} value={value.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} placeholder="e.g. Hypertrophy Block — Upper/Lower" />
        <Textarea label="Description" wrapClassName="sm:col-span-2" rows={2} maxLength={2000} value={value.description} onChange={(e) => set({ description: e.target.value })} placeholder="Goal of the block, progression rules, warm-up notes…" />
        <div className="sm:col-span-2">
          <Checkbox label="Save as a reusable template (not assigned to anyone)" checked={value.isTemplate} onChange={(e) => set({ isTemplate: e.target.checked, member: e.target.checked ? '' : value.member })} />
        </div>
        {!value.isTemplate && (
          <Select label="Assign to member" required value={value.member} onChange={(e) => set({ member: e.target.value })} placeholder={members.length ? 'Choose a member' : 'No assigned members'} options={members.map((m) => ({ value: m.user._id, label: m.user.name }))} error={errors.member} />
        )}
        <Select
          label="Status"
          value={value.status}
          onChange={(e) => set({ status: e.target.value as PlanDraft['status'] })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        {!value.isTemplate && (
          <>
            <Input label="Start date" type="date" value={value.startDate} onChange={(e) => set({ startDate: e.target.value })} error={errors.startDate} />
            <Input label="End date" type="date" value={value.endDate} min={value.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} error={errors.endDate} />
          </>
        )}
      </div>

      <div className="space-y-4">
        {value.days.map((day, i) => (
          <Card key={i} className="overflow-hidden !shadow-none">
            <div className="flex flex-wrap items-end gap-2 border-b border-line/70 bg-fg/[0.02] p-3">
              <span className="mb-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
              <Input aria-label={`Day ${i + 1} name`} wrapClassName="min-w-[120px] flex-1" value={day.name} maxLength={60} onChange={(e) => setDay(i, { name: e.target.value })} error={errors[`days.${i}.name`]} placeholder="Day name" />
              <Input aria-label={`Day ${i + 1} focus`} wrapClassName="min-w-[120px] flex-1" value={day.focus ?? ''} maxLength={100} onChange={(e) => setDay(i, { focus: e.target.value })} placeholder="Focus (e.g. Lower)" />
              <div className="mb-0.5 flex gap-1">
                <IconBtn label={`Move day ${i + 1} up`} disabled={i === 0} onClick={() => set({ days: move(value.days, i, -1) })}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Move day ${i + 1} down`} disabled={i === value.days.length - 1} onClick={() => set({ days: move(value.days, i, 1) })}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Duplicate day ${i + 1}`} disabled={value.days.length >= 14} onClick={() => set({ days: [...value.days.slice(0, i + 1), { ...day, name: `${day.name} (copy)`, exercises: day.exercises.map((x) => ({ ...x })) }, ...value.days.slice(i + 1)] })}>
                  <Copy className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Remove day ${i + 1}`} danger onClick={() => set({ days: value.days.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>
            <div className="space-y-2 p-3">
              {day.exercises.length === 0 && <p className="px-1 py-2 text-sm text-muted">No exercises yet.</p>}
              {day.exercises.map((x, j) => {
                const p = `days.${i}.exercises.${j}`;
                return (
                  <div key={j} className="rounded-xl border border-line/80 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-xs font-semibold text-muted">{j + 1}.</span>
                      <Input aria-label="Exercise name" wrapClassName="flex-1" value={x.name} maxLength={100} onChange={(e) => setEx(i, j, { name: e.target.value, exercise: null })} error={errors[`${p}.name`]} />
                      <div className="flex gap-1 pt-1">
                        <IconBtn label="Move exercise up" disabled={j === 0} onClick={() => setDay(i, { exercises: move(day.exercises, j, -1) })}>
                          <ArrowUp className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Move exercise down" disabled={j === day.exercises.length - 1} onClick={() => setDay(i, { exercises: move(day.exercises, j, 1) })}>
                          <ArrowDown className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Remove exercise" danger onClick={() => setDay(i, { exercises: day.exercises.filter((_, k) => k !== j) })}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 pl-7 sm:grid-cols-5">
                      <Input label="Sets" type="number" inputMode="numeric" min={1} max={20} value={x.sets} onChange={(e) => setEx(i, j, { sets: e.target.value as unknown as number })} error={errors[`${p}.sets`]} />
                      <Input label="Reps" maxLength={20} value={x.reps} onChange={(e) => setEx(i, j, { reps: e.target.value })} error={errors[`${p}.reps`]} placeholder="8–10" />
                      <Input label="kg" type="number" inputMode="decimal" step="0.5" value={x.weightKg ?? ''} onChange={(e) => setEx(i, j, { weightKg: e.target.value === '' ? null : (e.target.value as unknown as number) })} error={errors[`${p}.weightKg`]} />
                      <Input label="Rest (s)" type="number" inputMode="numeric" min={0} max={900} step={15} value={x.restSec} onChange={(e) => setEx(i, j, { restSec: e.target.value as unknown as number })} error={errors[`${p}.restSec`]} />
                      <Input label="Tempo" maxLength={20} value={x.tempo ?? ''} onChange={(e) => setEx(i, j, { tempo: e.target.value })} placeholder="3-1-1" />
                      <Input label="Coaching notes" wrapClassName="col-span-3 sm:col-span-5" maxLength={300} value={x.notes ?? ''} onChange={(e) => setEx(i, j, { notes: e.target.value })} placeholder="Cue, substitution, RPE target…" />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" icon={<Search className="h-3.5 w-3.5" />} disabled={day.exercises.length >= 30} onClick={() => setPickerFor(i)}>
                  Add from library
                </Button>
                <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} disabled={day.exercises.length >= 30} onClick={() => setDay(i, { exercises: [...day.exercises, { name: '', sets: 3, reps: '10', restSec: 90, tempo: '', notes: '' }] })}>
                  Custom exercise
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {errors.days && (
          <p role="alert" className="text-xs text-danger">
            {errors.days}
          </p>
        )}
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={value.days.length >= 14} onClick={() => set({ days: [...value.days, { name: `Day ${value.days.length + 1}`, focus: '', exercises: [] }] })}>
          Add training day
        </Button>
      </div>

      <ExercisePicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(ex) => {
          if (pickerFor === null) return;
          setDay(pickerFor, { exercises: [...value.days[pickerFor].exercises, { exercise: ex._id, name: ex.name, sets: 3, reps: ex.category === 'cardio' ? '60s' : '10', restSec: 90, tempo: '', notes: '' }] });
        }}
      />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-fg/[0.06] disabled:opacity-30 ${danger ? 'hover:text-danger' : 'hover:text-fg'}`}>
      {children}
    </button>
  );
}

const CATEGORIES = ['strength', 'cardio', 'mobility', 'conditioning', 'core', 'olympic', 'other'];
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('strength');
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (open) {
      setAdded(0);
      setCreating(false);
    }
  }, [open]);
  const list = useQuery({ queryKey: ['trainer', 'exercises', debounced], queryFn: () => api.get<Exercise[]>('/workouts/exercises', { q: debounced || undefined }), enabled: open });
  const create = useMutation({
    mutationFn: () => api.post<Exercise>('/workouts/exercises', { name: name.trim(), slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`, category }),
    onSuccess: (ex) => {
      toast.success(`${ex.name} added to the library`);
      void qc.invalidateQueries({ queryKey: ['trainer', 'exercises'] });
      onPick(ex);
      setAdded((n) => n + 1);
      setCreating(false);
      setName('');
    },
    onError: (e) => setErr(e instanceof ApiError ? (e.fieldErrors.name ?? e.message) : (e as Error).message),
  });
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Exercise library" description={added ? `${added} added — keep picking or close when done.` : 'Tap an exercise to add it to this day.'} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search exercises" className="pl-9" placeholder="Search e.g. squat, row, plank" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {creating ? (
          <form
            className="rounded-2xl border border-primary/40 bg-primary/5 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (name.trim().length < 2) return setErr('Name must be at least 2 characters');
              setErr(null);
              create.mutate();
            }}
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
              <Input label="New exercise" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} error={err ?? undefined} />
              <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))} />
              <div className="flex gap-1">
                <Button type="submit" loading={create.isPending}>
                  Create
                </Button>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => (setCreating(true), setName(q), setErr(null))}>
            Create a new exercise{q ? ` “${q}”` : ''}
          </Button>
        )}
        {list.isLoading ? (
          <Skeleton className="h-48" />
        ) : !list.data?.length ? (
          <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No exercises found" description="Create it above — it’ll be available to every coach." className="py-8" />
        ) : (
          <ul className="grid max-h-[50vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
            {list.data.map((ex) => (
              <li key={ex._id}>
                <button type="button" onClick={() => (onPick(ex), setAdded((n) => n + 1))} className="w-full rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-primary/50 hover:bg-primary/5">
                  <span className="block text-sm font-medium">{ex.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge>{titleCase(ex.category)}</Badge>
                    {ex.muscleGroups.slice(0, 2).map((m) => (
                      <Badge key={m} tone="neutral">
                        {m}
                      </Badge>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
