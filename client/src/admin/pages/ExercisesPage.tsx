import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, ConfirmDialog, DataTable, Input, Modal, PageHeader, Select, Textarea, useToast, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { PersonCell, RowActions } from '../components/Bits';
import { ChipsInput } from '../components/ChipsInput';
import { FilterBar, FilterSelect, SearchInput } from '../components/FilterBar';
import { ImageUploadField } from '../components/ImageUploadField';
import type { Exercise } from '../components/types';
import { applyApiErrors, cleanQuery, slugify, useDebounced } from '../components/utils';

const CATEGORIES = ['strength', 'cardio', 'mobility', 'conditioning', 'core', 'olympic', 'other'] as const;
const DIFFICULTY = ['beginner', 'intermediate', 'advanced'] as const;

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens'),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTY),
  muscleGroups: z.array(z.string()).max(10),
  equipment: z.array(z.string()).max(10),
  instructions: z.string().trim().max(4000),
  mediaUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === '' || /^(\/(?!\/)|https:\/\/)/i.test(v), 'Upload an image or use an https:// URL'),
  videoUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), 'Must be an https:// link'),
});
type Form = z.infer<typeof schema>;
const EMPTY: Form = { name: '', slug: '', category: 'strength', difficulty: 'beginner', muscleGroups: [], equipment: [], instructions: '', mediaUrl: '', videoUrl: '' };

function ExerciseModal({ open, onClose, exercise }: { open: boolean; onClose: () => void; exercise: Exercise | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slugTouched, setSlugTouched] = useState(false);
  const { register, control, handleSubmit, reset, watch, setValue, setError, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  useEffect(() => {
    if (!open) return;
    reset(exercise ? { name: exercise.name, slug: exercise.slug, category: exercise.category, difficulty: exercise.difficulty, muscleGroups: exercise.muscleGroups ?? [], equipment: exercise.equipment ?? [], instructions: exercise.instructions ?? '', mediaUrl: exercise.mediaUrl ?? '', videoUrl: exercise.videoUrl ?? '' } : EMPTY);
    setSlugTouched(Boolean(exercise));
  }, [open, exercise, reset]);
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name));
  }, [name, slugTouched, setValue]);
  const m = useMutation({
    mutationFn: (f: Form) => (exercise ? api.put(`/workouts/exercises/${exercise._id}`, f) : api.post('/workouts/exercises', f)),
    onSuccess: () => {
      toast.success(exercise ? 'Exercise updated' : 'Exercise added');
      void qc.invalidateQueries({ queryKey: ['admin', 'exercises'] });
      onClose();
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={exercise ? `Edit ${exercise.name}` : 'Add exercise'}
      description="Trainers pick from this library when building workout plans."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="exercise-form" loading={m.isPending}>
            {exercise ? 'Save' : 'Add exercise'}
          </Button>
        </>
      }
    >
      <form id="exercise-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Input label="Name" required error={e.name?.message} {...register('name')} />
        <Input label="Slug" required error={e.slug?.message} {...register('slug', { onChange: () => setSlugTouched(true) })} />
        <Select label="Category" options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))} {...register('category')} />
        <Select label="Difficulty" options={DIFFICULTY.map((c) => ({ value: c, label: titleCase(c) }))} {...register('difficulty')} />
        <Controller control={control} name="muscleGroups" render={({ field }) => <ChipsInput label="Muscle groups" value={field.value} onChange={field.onChange} max={10} maxLength={30} placeholder="e.g. Quads" />} />
        <Controller control={control} name="equipment" render={({ field }) => <ChipsInput label="Equipment" value={field.value} onChange={field.onChange} max={10} maxLength={30} placeholder="e.g. Barbell" />} />
        <Textarea label="Instructions" rows={5} wrapClassName="sm:col-span-2" maxLength={4000} error={e.instructions?.message} {...register('instructions')} />
        <div className="sm:col-span-2">
          <Controller control={control} name="mediaUrl" render={({ field }) => <ImageUploadField label="Image" folder="exercises" preferWidth={480} aspect="wide" value={field.value} onChange={field.onChange} error={e.mediaUrl?.message} />} />
        </div>
        <Input label="Video URL" placeholder="https://youtube.com/…" wrapClassName="sm:col-span-2" error={e.videoUrl?.message} {...register('videoUrl')} />
      </form>
    </Modal>
  );
}

export default function ExercisesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'' | (typeof CATEGORIES)[number]>('');
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Exercise | null>(null);
  const dq = useDebounced(q.trim(), 300);
  const filters = cleanQuery({ q: dq, category });
  const list = useQuery({ queryKey: ['admin', 'exercises', filters], queryFn: () => api.get<Exercise[]>('/workouts/exercises', filters), placeholderData: keepPreviousData });
  const del = useMutation({
    mutationFn: (x: Exercise) => api.delete(`/workouts/exercises/${x._id}`),
    onSuccess: () => {
      toast.success('Exercise deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'exercises'] });
      setDeleting(null);
    },
    onError: (err) => toast.error(err),
  });
  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const columns: Column<Exercise>[] = [
    {
      key: 'name',
      header: 'Exercise',
      cell: (x) => (
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-theme-sm border border-line bg-fg/[0.03]">{x.mediaUrl ? <img src={x.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Dumbbell className="h-4 w-4 text-muted" />}</div>
          <PersonCell name={x.name} sub={x.instructions ? x.instructions.slice(0, 70) + (x.instructions.length > 70 ? '…' : '') : undefined} />
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (x) => <Badge tone="primary">{x.category}</Badge> },
    { key: 'difficulty', header: 'Level', hideOnMobile: true, cell: (x) => <span className="text-muted">{titleCase(x.difficulty)}</span> },
    { key: 'muscles', header: 'Muscles', hideOnMobile: true, cell: (x) => <span className="text-xs text-muted">{x.muscleGroups.join(', ') || '—'}</span> },
    { key: 'equipment', header: 'Equipment', hideOnMobile: true, cell: (x) => <span className="text-xs text-muted">{x.equipment.join(', ') || '—'}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (x) => (
        <RowActions>
          {x.videoUrl && (
            <a href={x.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" aria-label="Open video">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Edit ${x.name}`}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditing(x);
              setOpen(true);
            }}
          />
          {hasRole('admin') && <Button size="sm" variant="ghost" className="text-danger" aria-label={`Delete ${x.name}`} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(x)} />}
        </RowActions>
      ),
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Exercise library"
        description="The movements trainers use to build workout plans."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            Add exercise
          </Button>
        }
      />
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search exercises" label="Search exercises" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))} />
      </FilterBar>
      <DataTable
        caption="Exercises"
        columns={columns}
        rows={list.data}
        rowKey={(x) => x._id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        empty={dq || category ? { title: 'No exercises match', description: 'Try a different search or category.' } : { title: 'The library is empty', description: 'Add the movements your coaches program most often.', action: <Button onClick={openNew}>Add exercise</Button> }}
      />
      {list.data && <p className="mt-3 text-xs text-muted">{list.data.length} exercises{list.data.length >= 500 ? ' (showing first 500 — refine your search)' : ''}</p>}
      <ExerciseModal open={open} onClose={() => setOpen(false)} exercise={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting)}
        loading={del.isPending}
        tone="danger"
        title={`Delete ${deleting?.name}?`}
        description="Removes it from the library. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
