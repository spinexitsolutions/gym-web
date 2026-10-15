import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, ArchiveRestore, Check, Package, Pencil, Plus, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, Switch, Tabs, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { ListEditor } from '../components/ListEditor';
import { MoneyInput } from '../components/MoneyInput';
import { usePlansAdmin } from '../components/queries';
import type { AdminPlan } from '../components/types';
import { applyApiErrors, slugify } from '../components/utils';

const int = (min: number, max: number, msg = `Between ${min} and ${max}`) => z.number({ invalid_type_error: 'Enter a number' }).int('Whole numbers only').min(min, msg).max(max, msg);

const schema = z
  .object({
    name: z.string().trim().min(1, 'Required').max(80),
    slug: z
      .string()
      .trim()
      .min(1, 'Required')
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens'),
    tagline: z.string().trim().max(140),
    description: z.string().trim().max(2000),
    durationDays: int(1, 1830),
    priceMinor: int(0, 100_000_000, 'Enter a valid price'),
    compareAtMinor: z.number().int().min(0).max(100_000_000).nullable(),
    benefits: z.array(z.string().trim().max(120, 'Max 120 characters')).max(20),
    classesPerWeek: z.number().int().min(0).max(50).nullable(),
    ptSessions: int(0, 100),
    guestPasses: int(0, 100),
    isTrial: z.boolean(),
    promoLabel: z.string().trim().max(40),
    highlight: z.boolean(),
    active: z.boolean(),
    order: int(0, 1000),
    cancellationPolicy: z.string().trim().max(1000),
    refundableDays: int(0, 60),
  })
  .refine((v) => v.compareAtMinor == null || v.compareAtMinor === 0 || v.compareAtMinor > v.priceMinor, { path: ['compareAtMinor'], message: 'Compare-at price should be higher than the price' });
type Form = z.infer<typeof schema>;

const EMPTY: Form = {
  name: '',
  slug: '',
  tagline: '',
  description: '',
  durationDays: 30,
  priceMinor: 0,
  compareAtMinor: null,
  benefits: [],
  classesPerWeek: null,
  ptSessions: 0,
  guestPasses: 0,
  isTrial: false,
  promoLabel: '',
  highlight: false,
  active: true,
  order: 50,
  cancellationPolicy: '',
  refundableDays: 0,
};

const fromPlan = (p: AdminPlan): Form => ({
  name: p.name,
  slug: p.slug,
  tagline: p.tagline ?? '',
  description: p.description ?? '',
  durationDays: p.durationDays,
  priceMinor: p.priceMinor,
  compareAtMinor: p.compareAtMinor ?? null,
  benefits: p.benefits ?? [],
  classesPerWeek: p.limits?.classesPerWeek ?? null,
  ptSessions: p.limits?.ptSessions ?? 0,
  guestPasses: p.limits?.guestPasses ?? 0,
  isTrial: p.isTrial,
  promoLabel: p.promoLabel ?? '',
  highlight: p.highlight,
  active: p.active,
  order: p.order ?? 50,
  cancellationPolicy: p.cancellationPolicy ?? '',
  refundableDays: p.refundableDays ?? 0,
});

const toBody = (f: Form) => {
  const { classesPerWeek, ptSessions, guestPasses, compareAtMinor, benefits, ...rest } = f;
  return { ...rest, compareAtMinor: compareAtMinor || null, benefits: benefits.map((b) => b.trim()).filter(Boolean), limits: { classesPerWeek, ptSessions, guestPasses } };
};

const DURATIONS = [
  { d: 7, l: '1 week' },
  { d: 30, l: '1 month' },
  { d: 90, l: '3 months' },
  { d: 180, l: '6 months' },
  { d: 365, l: '1 year' },
];

function PlanCard({ plan, onEdit, onArchive, onRestore }: { plan: AdminPlan | Form; onEdit?: () => void; onArchive?: () => void; onRestore?: () => void }) {
  const limits = 'limits' in plan ? plan.limits : { classesPerWeek: plan.classesPerWeek, ptSessions: plan.ptSessions, guestPasses: plan.guestPasses };
  const months = plan.durationDays >= 28 ? Math.round(plan.durationDays / 30) : 0;
  const perMonth = months > 1 ? Math.round(plan.priceMinor / months) : 0;
  return (
    <Card className={cn('relative flex h-full flex-col p-5', plan.highlight && 'ring-1 ring-primary/60', !plan.active && 'opacity-60')}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {plan.highlight && <Badge tone="primary">Featured</Badge>}
        {plan.promoLabel && <Badge tone="warning">{plan.promoLabel}</Badge>}
        {plan.isTrial && <Badge tone="info">Trial</Badge>}
        {!plan.active && <Badge>Archived</Badge>}
      </div>
      <h3 className="font-display text-lg font-semibold">{plan.name || 'Untitled plan'}</h3>
      {plan.tagline && <p className="text-sm text-muted">{plan.tagline}</p>}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums">{money(plan.priceMinor)}</span>
        {plan.compareAtMinor ? <span className="text-sm text-muted line-through">{money(plan.compareAtMinor)}</span> : null}
      </div>
      <p className="text-xs text-muted">
        {plan.durationDays} days{perMonth ? ` · ≈ ${money(perMonth)}/month` : ''}
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm">
        {plan.benefits.filter(Boolean).slice(0, 6).map((b, i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{b}</span>
          </li>
        ))}
        {plan.benefits.length > 6 && <li className="text-xs text-muted">+{plan.benefits.length - 6} more</li>}
      </ul>
      <p className="mt-4 border-t border-line/70 pt-3 text-xs text-muted">
        {limits.classesPerWeek == null ? 'Unlimited classes' : `${limits.classesPerWeek} classes/week`} · {limits.ptSessions} PT · {limits.guestPasses} guest passes
        {plan.refundableDays ? ` · refundable ${plan.refundableDays}d` : ''}
      </p>
      {(onEdit || onArchive || onRestore) && (
        <div className="mt-4 flex gap-2">
          {onEdit && (
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {onArchive && (
            <Button size="sm" variant="ghost" icon={<Archive className="h-3.5 w-3.5" />} onClick={onArchive}>
              Archive
            </Button>
          )}
          {onRestore && (
            <Button size="sm" variant="ghost" icon={<ArchiveRestore className="h-3.5 w-3.5" />} onClick={onRestore}>
              Restore
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function PlanFormModal({ plan, open, onClose }: { plan: AdminPlan | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slugTouched, setSlugTouched] = useState(false);
  const { register, control, handleSubmit, watch, setValue, reset, setError, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  useEffect(() => {
    if (open) {
      reset(plan ? fromPlan(plan) : EMPTY);
      setSlugTouched(Boolean(plan));
    }
  }, [open, plan, reset]);
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name), { shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, setValue, formState.isSubmitted]);
  const values = watch();
  const m = useMutation({
    mutationFn: (f: Form) => (plan ? api.put(`/plans/admin/${plan._id}`, toBody(f)) : api.post('/plans/admin', toBody(f))),
    onSuccess: () => {
      toast.success(plan ? 'Plan updated' : 'Plan created', plan ? 'Existing memberships keep their original price.' : undefined);
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      onClose();
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError, { 'limits.classesPerWeek': 'classesPerWeek', 'limits.ptSessions': 'ptSessions', 'limits.guestPasses': 'guestPasses' })) toast.error(err);
    },
  });
  const e = formState.errors;
  const num = { valueAsNumber: true } as const;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      description="Price changes only affect new purchases."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={m.isPending}>
            {plan ? 'Save plan' : 'Create plan'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form id="plan-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
          <Input label="Name" required error={e.name?.message} {...register('name')} />
          <Input
            label="Slug"
            required
            error={e.slug?.message}
            hint="Used in links. Auto-filled from the name."
            {...register('slug', { onChange: () => setSlugTouched(true) })}
          />
          <Input label="Tagline" wrapClassName="sm:col-span-2" maxLength={140} error={e.tagline?.message} {...register('tagline')} />
          <Textarea label="Description" rows={3} wrapClassName="sm:col-span-2" maxLength={2000} error={e.description?.message} {...register('description')} />

          <div className="sm:col-span-2">
            <Input type="number" label="Duration (days)" required min={1} max={1830} error={e.durationDays?.message} {...register('durationDays', num)} />
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Duration presets">
              {DURATIONS.map((p) => (
                <button
                  key={p.d}
                  type="button"
                  onClick={() => setValue('durationDays', p.d, { shouldDirty: true, shouldValidate: true })}
                  className={cn('rounded-full border px-3 py-1 text-xs transition', values.durationDays === p.d ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:text-fg')}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <Controller control={control} name="priceMinor" render={({ field }) => <MoneyInput label="Price" required value={field.value} onChange={(v) => field.onChange(v ?? 0)} error={e.priceMinor?.message} hint="0 for a free trial." />} />
          <Controller control={control} name="compareAtMinor" render={({ field }) => <MoneyInput label="Compare-at price" value={field.value} onChange={field.onChange} error={e.compareAtMinor?.message} hint="Optional strike-through price." />} />

          <div className="sm:col-span-2">
            <Controller control={control} name="benefits" render={({ field }) => <ListEditor label="Benefits" value={field.value} onChange={field.onChange} placeholder="e.g. Unlimited floor access" error={e.benefits?.message ?? (Array.isArray(e.benefits) ? e.benefits.find(Boolean)?.message : undefined)} />} />
          </div>

          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <legend className="eyebrow mb-3">Limits</legend>
            <Controller
              control={control}
              name="classesPerWeek"
              render={({ field }) => (
                <div>
                  <Input
                    type="number"
                    label="Classes / week"
                    min={0}
                    max={50}
                    disabled={field.value === null}
                    value={field.value ?? ''}
                    onChange={(ev) => field.onChange(ev.target.value === '' ? 0 : Number(ev.target.value))}
                    error={e.classesPerWeek?.message}
                  />
                  <Checkbox className="mt-2" label="Unlimited" checked={field.value === null} onChange={(ev) => field.onChange(ev.target.checked ? null : 4)} />
                </div>
              )}
            />
            <Input type="number" label="PT sessions" min={0} max={100} error={e.ptSessions?.message} {...register('ptSessions', num)} />
            <Input type="number" label="Guest passes" min={0} max={100} error={e.guestPasses?.message} {...register('guestPasses', num)} />
          </fieldset>

          <Input label="Promo label" placeholder="e.g. Best value" maxLength={40} error={e.promoLabel?.message} {...register('promoLabel')} />
          <Input type="number" label="Display order" min={0} max={1000} hint="Lower shows first." error={e.order?.message} {...register('order', num)} />
          <Input type="number" label="Refundable within (days)" min={0} max={60} error={e.refundableDays?.message} {...register('refundableDays', num)} />
          <div />
          <Textarea label="Cancellation policy" rows={2} wrapClassName="sm:col-span-2" maxLength={1000} error={e.cancellationPolicy?.message} {...register('cancellationPolicy')} />

          <div className="grid gap-4 rounded-theme-sm border border-line p-4 sm:col-span-2">
            <Controller control={control} name="active" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" description="Visible on the website and available at checkout." />} />
            <Controller control={control} name="highlight" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Featured" description="Highlights this plan on the pricing page." />} />
            <Controller control={control} name="isTrial" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Trial plan" description="Marks memberships from this plan as trials." />} />
          </div>
        </form>
        <aside aria-label="Preview" className="hidden lg:block">
          <p className="eyebrow mb-3">Preview</p>
          <div className="sticky top-0">
            <PlanCard plan={values} />
          </div>
        </aside>
      </div>
    </Modal>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const plans = usePlansAdmin();
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [archiving, setArchiving] = useState<AdminPlan | null>(null);
  const shown = useMemo(() => (plans.data ?? []).filter((p) => (filter === 'active' ? p.active : !p.active)), [plans.data, filter]);
  const archivedCount = (plans.data ?? []).filter((p) => !p.active).length;

  const archive = useMutation({
    mutationFn: (p: AdminPlan) => api.delete(`/plans/admin/${p._id}`),
    onSuccess: () => {
      toast.success('Plan archived', 'Existing memberships are unaffected.');
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      setArchiving(null);
    },
    onError: (err) => toast.error(err),
  });
  const restore = useMutation({
    mutationFn: (p: AdminPlan) => api.put(`/plans/admin/${p._id}`, toBody({ ...fromPlan(p), active: true })),
    onSuccess: () => {
      toast.success('Plan restored');
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
    onError: (err) => toast.error(err),
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Plans"
        description="Membership plans shown on the website and used at checkout and the front desk."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            New plan
          </Button>
        }
      />
      <Tabs
        className="mb-5 w-fit"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'active', label: 'Active', count: (plans.data ?? []).length - archivedCount },
          { value: 'archived', label: 'Archived', count: archivedCount },
        ]}
      />
      {plans.error ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      ) : plans.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={filter === 'active' ? <Package className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
          title={filter === 'active' ? 'No active plans' : 'No archived plans'}
          description={filter === 'active' ? 'Create a plan so members can buy a membership.' : 'Archived plans keep their history and can be restored.'}
          action={
            filter === 'active' ? (
              <Button icon={<Sparkles className="h-4 w-4" />} onClick={openNew}>
                Create a plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((p) => (
            <PlanCard
              key={p._id}
              plan={p}
              onEdit={() => {
                setEditing(p);
                setFormOpen(true);
              }}
              onArchive={p.active ? () => setArchiving(p) : undefined}
              onRestore={!p.active ? () => restore.mutate(p) : undefined}
            />
          ))}
        </div>
      )}
      <PlanFormModal open={formOpen} plan={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archiving && archive.mutate(archiving)}
        loading={archive.isPending}
        tone="danger"
        title={`Archive ${archiving?.name}?`}
        description="The plan is hidden from the website and checkout. Existing memberships and payment history are kept, and you can restore it later."
        confirmLabel="Archive plan"
      />
    </div>
  );
}
