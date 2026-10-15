import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { applyFieldErrors, optNum, toDateInput, zr } from './utils';

const num = (min: number, max: number, label: string) =>
  z.preprocess(optNum, z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).optional());

const schema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    weightKg: num(20, 400, 'Weight'),
    bodyFatPct: num(2, 70, 'Body fat'),
    chestCm: num(0, 300, 'Chest'),
    waistCm: num(0, 300, 'Waist'),
    hipsCm: num(0, 300, 'Hips'),
    armCm: num(0, 150, 'Arm'),
    thighCm: num(0, 200, 'Thigh'),
    notes: z.string().max(1000).default(''),
  })
  .refine((v) => v.date <= toDateInput(new Date()), { path: ['date'], message: 'Date can’t be in the future' })
  .refine((v) => [v.weightKg, v.bodyFatPct, v.chestCm, v.waistCm, v.hipsCm, v.armCm, v.thighCm].some((x) => x !== undefined), { path: ['weightKg'], message: 'Enter at least one measurement' });
type FormOut = z.output<typeof schema>;

/** Modal form to log a progress check-in for `memberPath` (e.g. "/members/me"). */
export function ProgressEntryForm({ open, onClose, memberPath, invalidate, defaultWeight }: { open: boolean; onClose: () => void; memberPath: string; invalidate: QueryKey[]; defaultWeight?: number | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<FormOut>({ resolver: zr<FormOut>(schema), defaultValues: { date: toDateInput(new Date()), notes: '' } });
  const { register, handleSubmit, formState, reset, setError } = form;

  useEffect(() => {
    if (open) reset({ date: toDateInput(new Date()), notes: '', weightKg: defaultWeight ?? undefined } as FormOut);
  }, [open, reset, defaultWeight]);

  const save = useMutation({
    mutationFn: (v: FormOut) =>
      api.post(`${memberPath}/progress`, {
        date: new Date(`${v.date}T12:00:00`).toISOString(),
        weightKg: v.weightKg ?? null,
        bodyFatPct: v.bodyFatPct ?? null,
        measurements: Object.fromEntries(Object.entries({ chestCm: v.chestCm, waistCm: v.waistCm, hipsCm: v.hipsCm, armCm: v.armCm, thighCm: v.thighCm }).filter(([, x]) => x !== undefined)),
        notes: v.notes,
      }),
    onSuccess: async () => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      toast.success('Progress logged', 'Consistency beats perfection — nice work.');
      onClose();
    },
    onError: (err) => {
      if (!applyFieldErrors(err, setError, { 'measurements.chestCm': 'chestCm', 'measurements.waistCm': 'waistCm', 'measurements.hipsCm': 'hipsCm', 'measurements.armCm': 'armCm', 'measurements.thighCm': 'thighCm' })) toast.error(err);
    },
  });

  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a progress check-in"
      description="Weigh in under similar conditions each time (e.g. mornings, before food) for the most reliable trend."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="progress-form" loading={save.isPending}>
            Save entry
          </Button>
        </>
      }
    >
      <form id="progress-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Date" type="date" max={toDateInput(new Date())} {...register('date')} error={e.date?.message} required />
          <Input label="Weight (kg)" type="number" inputMode="decimal" step="0.1" {...register('weightKg')} error={e.weightKg?.message} />
          <Input label="Body fat (%)" type="number" inputMode="decimal" step="0.1" {...register('bodyFatPct')} error={e.bodyFatPct?.message} />
        </div>
        <fieldset>
          <legend className="label">Measurements (cm) — optional</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Input aria-label="Chest (cm)" placeholder="Chest" type="number" inputMode="decimal" step="0.1" {...register('chestCm')} error={e.chestCm?.message} />
            <Input aria-label="Waist (cm)" placeholder="Waist" type="number" inputMode="decimal" step="0.1" {...register('waistCm')} error={e.waistCm?.message} />
            <Input aria-label="Hips (cm)" placeholder="Hips" type="number" inputMode="decimal" step="0.1" {...register('hipsCm')} error={e.hipsCm?.message} />
            <Input aria-label="Arm (cm)" placeholder="Arm" type="number" inputMode="decimal" step="0.1" {...register('armCm')} error={e.armCm?.message} />
            <Input aria-label="Thigh (cm)" placeholder="Thigh" type="number" inputMode="decimal" step="0.1" {...register('thighCm')} error={e.thighCm?.message} />
          </div>
        </fieldset>
        <Textarea label="Notes" rows={2} placeholder="How are you feeling? Sleep, energy, anything notable…" {...register('notes')} error={e.notes?.message} />
      </form>
    </Modal>
  );
}
