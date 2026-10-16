import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell, EyeOff, Mail, Pencil, Plus, Users } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, StatusBadge, Switch, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { AvailabilityEditor } from '../components/AvailabilityEditor';
import { ChipsInput } from '../components/ChipsInput';
import { ImageUploadField } from '../components/ImageUploadField';
import { useTrainersAdmin } from '../components/queries';
import type { AdminTrainer } from '../components/types';
import { WEEKDAYS, applyApiErrors, slugify } from '../components/utils';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().max(30),
  displayName: z.string().trim().min(2, 'At least 2 characters').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens'),
  title: z.string().trim().max(100),
  bio: z.string().trim().max(3000),
  specializations: z.array(z.string()).max(12),
  certifications: z.array(z.string()).max(12),
  photoUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === '' || /^(\/(?!\/)|https:\/\/)/i.test(v), 'Upload an image or use an https:// URL'),
  instagram: z.string().trim().max(300),
  experienceYears: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(70),
  ptSessionMinutes: z.number({ invalid_type_error: 'Enter a number' }).int().min(15, 'At least 15').max(240),
  maxClients: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(500),
  order: z.number({ invalid_type_error: 'Enter a number' }).int().min(0).max(1000),
  showOnWebsite: z.boolean(),
  availability: z.array(z.object({ day: z.number().int().min(0).max(6), start: time, end: time }).refine((a) => a.start < a.end, 'End must be after start')).max(21),
});
type Form = z.infer<typeof schema>;

const EMPTY: Form = { name: '', email: '', phone: '', displayName: '', slug: '', title: '', bio: '', specializations: [], certifications: [], photoUrl: '', instagram: '', experienceYears: 0, ptSessionMinutes: 60, maxClients: 30, order: 50, showOnWebsite: true, availability: [] };
const fromTrainer = (t: AdminTrainer): Form => ({
  name: t.user.name,
  email: t.user.email,
  phone: t.user.phone ?? '',
  displayName: t.displayName,
  slug: t.slug,
  title: t.title ?? '',
  bio: t.bio ?? '',
  specializations: t.specializations ?? [],
  certifications: t.certifications ?? [],
  photoUrl: t.photoUrl ?? '',
  instagram: t.instagram ?? '',
  experienceYears: t.experienceYears ?? 0,
  ptSessionMinutes: t.ptSessionMinutes ?? 60,
  maxClients: t.maxClients ?? 30,
  order: t.order ?? 50,
  showOnWebsite: t.showOnWebsite,
  availability: (t.availability ?? []).map(({ day, start, end }) => ({ day, start, end })),
});

function TrainerFormModal({ trainer, open, onClose }: { trainer: AdminTrainer | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slugTouched, setSlugTouched] = useState(false);
  const { register, control, handleSubmit, reset, watch, setValue, setError, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  useEffect(() => {
    if (open) {
      reset(trainer ? fromTrainer(trainer) : EMPTY);
      setSlugTouched(Boolean(trainer));
    }
  }, [open, trainer, reset]);
  const displayName = watch('displayName');
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(displayName || name));
  }, [displayName, name, slugTouched, setValue]);

  const m = useMutation({
    mutationFn: (f: Form) => {
      if (trainer) {
        const { email, ...rest } = f;
        void email;
        return api.put<{ note?: string }>(`/trainers/admin/${trainer.user._id}`, rest);
      }
      return api.post<{ note?: string }>('/trainers/admin', f);
    },
    onSuccess: (r) => {
      toast.success(trainer ? 'Trainer updated' : 'Trainer created', r.note);
      void qc.invalidateQueries({ queryKey: ['admin', 'trainers'] });
      onClose();
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError)) toast.error(err);
    },
  });
  const e = formState.errors;
  const num = { valueAsNumber: true } as const;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={trainer ? `Edit ${trainer.displayName}` : 'Add trainer'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="trainer-form" loading={m.isPending}>
            {trainer ? 'Save trainer' : 'Create trainer & send invite'}
          </Button>
        </>
      }
    >
      <form id="trainer-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        {!trainer && (
          <Alert tone="info" className="sm:col-span-2" title="A password-setup email is sent">
            The trainer receives an email with a link to set their password, then signs in to the trainer dashboard. No password is shared by staff.
          </Alert>
        )}
        <p className="eyebrow sm:col-span-2">Account</p>
        <Input label="Full name" required error={e.name?.message} {...register('name')} />
        <Input label="Email" type="email" required disabled={Boolean(trainer)} hint={trainer ? 'Email can’t be changed here.' : 'Used to sign in.'} error={e.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" error={e.phone?.message} {...register('phone')} />
        <Input type="number" label="Max clients" min={0} max={500} error={e.maxClients?.message} {...register('maxClients', num)} />

        <p className="eyebrow mt-2 sm:col-span-2">Public profile</p>
        <Input label="Display name" required error={e.displayName?.message} {...register('displayName')} />
        <Input label="Profile URL slug" required error={e.slug?.message} hint={`/trainers/${watch('slug') || '…'}`} {...register('slug', { onChange: () => setSlugTouched(true) })} />
        <Input label="Title" placeholder="e.g. Head of Strength" error={e.title?.message} {...register('title')} />
        <Input type="number" label="Years of experience" min={0} max={70} error={e.experienceYears?.message} {...register('experienceYears', num)} />
        <div className="sm:col-span-2">
          <Controller control={control} name="photoUrl" render={({ field }) => <ImageUploadField label="Photo" folder="trainers" preferWidth={480} value={field.value} onChange={field.onChange} error={e.photoUrl?.message} />} />
        </div>
        <Textarea label="Bio" rows={4} wrapClassName="sm:col-span-2" maxLength={3000} error={e.bio?.message} {...register('bio')} />
        <Controller control={control} name="specializations" render={({ field }) => <ChipsInput label="Specializations" value={field.value} onChange={field.onChange} max={12} maxLength={40} placeholder="e.g. Powerlifting" error={e.specializations?.message} />} />
        <Controller control={control} name="certifications" render={({ field }) => <ChipsInput label="Certifications" value={field.value} onChange={field.onChange} max={12} maxLength={80} placeholder="e.g. NSCA-CSCS" error={e.certifications?.message} />} />
        <Input label="Instagram URL" placeholder="https://instagram.com/…" error={e.instagram?.message} {...register('instagram')} />
        <Input type="number" label="PT session length (min)" min={15} max={240} error={e.ptSessionMinutes?.message} {...register('ptSessionMinutes', num)} />

        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="availability"
            render={({ field }) => <AvailabilityEditor value={field.value} onChange={field.onChange} error={e.availability?.message ?? (Array.isArray(e.availability) ? 'Fix the highlighted rows' : undefined)} />}
          />
        </div>
        <Input type="number" label="Display order" min={0} max={1000} hint="Lower shows first on the website." error={e.order?.message} {...register('order', num)} />
        <div className="self-end pb-1">
          <Controller control={control} name="showOnWebsite" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Show on website" description="Lists the trainer on the public Trainers page." />} />
        </div>
      </form>
    </Modal>
  );
}

function summarizeAvailability(t: AdminTrainer) {
  const days = Array.from(new Set((t.availability ?? []).map((a) => a.day))).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return days.length ? days.map((d) => WEEKDAYS[d]).join(' · ') : 'No availability set';
}

export default function TrainersPage() {
  const trainers = useTrainersAdmin();
  const [editing, setEditing] = useState<AdminTrainer | null>(null);
  const [open, setOpen] = useState(false);
  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Trainers"
        description="Coaching team profiles, availability and client load."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            Add trainer
          </Button>
        }
      />
      {trainers.error ? (
        <ErrorState error={trainers.error} onRetry={() => trainers.refetch()} />
      ) : trainers.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !trainers.data?.length ? (
        <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No trainers yet" description="Add your coaching team so members can book personal training and classes can be assigned." action={<Button onClick={openNew}>Add the first trainer</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trainers.data.map((t) => {
            const load = t.maxClients ? Math.min(100, (t.assignedMembers / t.maxClients) * 100) : 0;
            return (
              <Card key={t._id} className="flex flex-col p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={t.displayName} src={t.photoUrl || undefined} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate font-display text-lg font-semibold">{t.displayName}</h3>
                      {t.user.status !== 'active' && <StatusBadge status={t.user.status} />}
                    </div>
                    <p className="truncate text-sm text-muted">{t.title || 'Trainer'}{t.experienceYears ? ` · ${t.experienceYears} yrs` : ''}</p>
                    <a href={`mailto:${t.user.email}`} className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted hover:text-fg">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{t.user.email}</span>
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${t.displayName}`}
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => {
                      setEditing(t);
                      setOpen(true);
                    }}
                  />
                </div>
                {t.specializations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {t.specializations.map((s) => (
                      <Badge key={s} tone="primary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex-1 space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <Link to={`/admin/members?trainer=${t.user._id}`} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
                        <Users className="h-3.5 w-3.5" /> Assigned members
                      </Link>
                      <span className="tabular-nums">
                        {t.assignedMembers}
                        {t.maxClients ? ` / ${t.maxClients}` : ''}
                      </span>
                    </div>
                    {t.maxClients ? (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
                        <div className={`h-full rounded-full ${load >= 90 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${load}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">{summarizeAvailability(t)}</p>
                  {t.certifications.length > 0 && <p className="text-xs text-muted">Certified: {t.certifications.join(', ')}</p>}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-line/70 pt-3 text-xs text-muted">
                  {t.showOnWebsite ? (
                    <Badge tone="success">On website</Badge>
                  ) : (
                    <Badge>
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                  <span>Order {t.order}</span>
                  {t.ptSessionMinutes ? <span>· PT {t.ptSessionMinutes} min</span> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <TrainerFormModal open={open} trainer={editing} onClose={() => setOpen(false)} />
    </div>
  );
}
