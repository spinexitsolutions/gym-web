import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Power, PowerOff, Tag } from 'lucide-react';
import { Badge, Button, Checkbox, ConfirmDialog, DataTable, Input, Modal, PageHeader, Select, Switch, Tabs, useToast, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, money } from '@/lib/format';
import { PersonCell, RowActions } from '../components/Bits';
import { SearchInput } from '../components/FilterBar';
import { MoneyInput } from '../components/MoneyInput';
import { usePlansAdmin } from '../components/queries';
import type { Coupon } from '../components/types';
import { applyApiErrors, endOfDayIso, startOfDayIso, toDateInput } from '../components/utils';

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'At least 3 characters')
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, 'Letters, numbers, - and _ only'),
    description: z.string().trim().max(200),
    type: z.enum(['percent', 'flat']),
    percent: z.number().int().min(1).max(100).nullable(),
    flatMinor: z.number().int().min(0).nullable(),
    maxDiscountMinor: z.number().int().min(0).nullable(),
    minAmountMinor: z.number().int().min(0).nullable(),
    validFrom: z.string(),
    validUntil: z.string(),
    usageLimit: z.number({ invalid_type_error: 'Enter a number' }).int().min(1, 'At least 1').nullable(),
    perUserLimit: z.number({ invalid_type_error: 'Enter a number' }).int().min(1, 'At least 1'),
    plans: z.array(z.string()),
    newMembersOnly: z.boolean(),
    active: z.boolean(),
    campaign: z.string().trim().max(60),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'percent' && !v.percent) ctx.addIssue({ code: 'custom', path: ['percent'], message: 'Enter a percentage (1–100)' });
    if (v.type === 'flat' && (!v.flatMinor || v.flatMinor < 100)) ctx.addIssue({ code: 'custom', path: ['flatMinor'], message: 'Enter an amount (at least ₹1)' });
    if (v.validFrom && v.validUntil && v.validUntil < v.validFrom) ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'Must be after the start date' });
  });
type Form = z.infer<typeof schema>;

const EMPTY: Form = { code: '', description: '', type: 'percent', percent: 10, flatMinor: null, maxDiscountMinor: null, minAmountMinor: null, validFrom: '', validUntil: '', usageLimit: null, perUserLimit: 1, plans: [], newMembersOnly: false, active: true, campaign: '' };

const fromCoupon = (c: Coupon): Form => ({
  code: c.code,
  description: c.description ?? '',
  type: c.type,
  percent: c.type === 'percent' ? c.value : null,
  flatMinor: c.type === 'flat' ? c.value : null,
  maxDiscountMinor: c.maxDiscountMinor ?? null,
  minAmountMinor: c.minAmountMinor || null,
  validFrom: toDateInput(c.validFrom),
  validUntil: toDateInput(c.validUntil),
  usageLimit: c.usageLimit ?? null,
  perUserLimit: c.perUserLimit ?? 1,
  plans: (c.plans ?? []).map(String),
  newMembersOnly: Boolean(c.newMembersOnly),
  active: c.active,
  campaign: c.campaign ?? '',
});

const toBody = (f: Form) => ({
  code: f.code,
  description: f.description,
  type: f.type,
  value: f.type === 'percent' ? f.percent : f.flatMinor,
  maxDiscountMinor: f.type === 'percent' ? f.maxDiscountMinor || null : null,
  minAmountMinor: f.minAmountMinor ?? 0,
  validFrom: f.validFrom ? startOfDayIso(f.validFrom) : null,
  validUntil: f.validUntil ? endOfDayIso(f.validUntil) : null,
  usageLimit: f.usageLimit || null,
  perUserLimit: f.perUserLimit,
  plans: f.plans,
  newMembersOnly: f.newMembersOnly,
  active: f.active,
  campaign: f.campaign,
});

type CouponState = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';
function couponState(c: Coupon): CouponState {
  const now = Date.now();
  if (!c.active) return 'inactive';
  if (c.validUntil && new Date(c.validUntil).getTime() < now) return 'expired';
  if (c.usageLimit && (c.usedCount ?? 0) >= c.usageLimit) return 'exhausted';
  if (c.validFrom && new Date(c.validFrom).getTime() > now) return 'scheduled';
  return 'active';
}
const stateTone: Record<CouponState, 'success' | 'info' | 'neutral' | 'warning' | 'danger'> = { active: 'success', scheduled: 'info', expired: 'neutral', exhausted: 'warning', inactive: 'danger' };

function CouponFormModal({ coupon, open, onClose }: { coupon: Coupon | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const plans = usePlansAdmin(open);
  const { register, control, handleSubmit, watch, reset, setError, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  useEffect(() => {
    if (open) reset(coupon ? fromCoupon(coupon) : EMPTY);
  }, [open, coupon, reset]);
  const type = watch('type');
  const m = useMutation({
    mutationFn: (f: Form) => (coupon ? api.put<Coupon>(`/plans/admin/coupons/${coupon._id}`, toBody(f)) : api.post<Coupon>('/plans/admin/coupons', toBody(f))),
    onSuccess: (c) => {
      toast.success(coupon ? 'Coupon updated' : 'Coupon created', c.code);
      void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      onClose();
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError, { value: type === 'percent' ? 'percent' : 'flatMinor' })) toast.error(err);
    },
  });
  const e = formState.errors;
  const num = { setValueAs: (v: string) => (v === '' || v == null ? null : Number(v)) };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      description="Discounts apply at online checkout. The server validates every rule."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" loading={m.isPending}>
            {coupon ? 'Save coupon' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => m.mutate(f))} noValidate>
        <Input label="Code" required className="font-mono uppercase" error={e.code?.message} {...register('code')} />
        <Input label="Campaign" placeholder="e.g. diwali-2026" error={e.campaign?.message} {...register('campaign')} />
        <Input label="Description" wrapClassName="sm:col-span-2" maxLength={200} error={e.description?.message} {...register('description')} />
        <Select
          label="Discount type"
          options={[
            { value: 'percent', label: 'Percentage' },
            { value: 'flat', label: 'Flat amount' },
          ]}
          {...register('type')}
        />
        {type === 'percent' ? (
          <Input type="number" label="Percent off" required min={1} max={100} error={e.percent?.message} {...register('percent', num)} />
        ) : (
          <Controller control={control} name="flatMinor" render={({ field }) => <MoneyInput label="Amount off" required value={field.value} onChange={field.onChange} error={e.flatMinor?.message} />} />
        )}
        {type === 'percent' && <Controller control={control} name="maxDiscountMinor" render={({ field }) => <MoneyInput label="Maximum discount" value={field.value} onChange={field.onChange} hint="Optional cap" error={e.maxDiscountMinor?.message} />} />}
        <Controller control={control} name="minAmountMinor" render={({ field }) => <MoneyInput label="Minimum order" value={field.value} onChange={field.onChange} hint="Optional" error={e.minAmountMinor?.message} />} />
        <Input type="date" label="Valid from" error={e.validFrom?.message} hint="Empty = immediately" {...register('validFrom')} />
        <Input type="date" label="Valid until" error={e.validUntil?.message} hint="Empty = no end date" {...register('validUntil')} />
        <Input type="number" label="Total uses" min={1} error={e.usageLimit?.message} hint={coupon ? `Used ${coupon.usedCount ?? 0} times. Empty = unlimited.` : 'Empty = unlimited'} {...register('usageLimit', num)} />
        <Input type="number" label="Uses per member" min={1} required error={e.perUserLimit?.message} {...register('perUserLimit', { valueAsNumber: true })} />
        <Controller
          control={control}
          name="plans"
          render={({ field }) => (
            <fieldset className="sm:col-span-2">
              <legend className="label">Applies to plans</legend>
              <p className="mb-2 text-xs text-muted">{field.value.length ? `Restricted to ${field.value.length} plan(s).` : 'No restriction — valid for all plans.'}</p>
              <div className="grid gap-2 rounded-theme-sm border border-line p-3 sm:grid-cols-2">
                {plans.isLoading && <p className="text-sm text-muted">Loading plans…</p>}
                {(plans.data ?? []).map((p) => (
                  <Checkbox
                    key={p._id}
                    label={
                      <span>
                        {p.name} <span className="text-muted">· {money(p.priceMinor)}</span>
                        {!p.active && <span className="text-muted"> (archived)</span>}
                      </span>
                    }
                    checked={field.value.includes(p._id)}
                    onChange={(ev) => field.onChange(ev.target.checked ? [...field.value, p._id] : field.value.filter((x) => x !== p._id))}
                  />
                ))}
              </div>
            </fieldset>
          )}
        />
        <div className="grid gap-4 rounded-theme-sm border border-line p-4 sm:col-span-2">
          <Controller control={control} name="newMembersOnly" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="New members only" description="Only members without any previous membership can use it." />} />
          <Controller control={control} name="active" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" />} />
        </div>
      </form>
    </Modal>
  );
}

export default function CouponsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.get<Coupon[]>('/plans/admin/coupons/all') });
  const plans = usePlansAdmin();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | CouponState>('all');
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<Coupon | null>(null);
  const planName = (id: string) => plans.data?.find((p) => p._id === id)?.name ?? 'Plan';

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data ?? []).filter((c) => (view === 'all' || couponState(c) === view) && (!s || c.code.toLowerCase().includes(s) || (c.campaign ?? '').toLowerCase().includes(s) || (c.description ?? '').toLowerCase().includes(s)));
  }, [list.data, q, view]);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of list.data ?? []) out[couponState(c)] = (out[couponState(c)] ?? 0) + 1;
    return out;
  }, [list.data]);

  const deactivate = useMutation({
    mutationFn: (c: Coupon) => api.delete(`/plans/admin/coupons/${c._id}`),
    onSuccess: () => {
      toast.success('Coupon deactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      setDeactivating(null);
    },
    onError: (err) => toast.error(err),
  });
  const reactivate = useMutation({
    mutationFn: (c: Coupon) => api.put(`/plans/admin/coupons/${c._id}`, toBody({ ...fromCoupon(c), active: true })),
    onSuccess: () => {
      toast.success('Coupon reactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => toast.error(err),
  });

  const columns: Column<Coupon>[] = [
    { key: 'code', header: 'Code', cell: (c) => <PersonCell name={<code className="font-mono text-sm font-semibold tracking-wide">{c.code}</code>} sub={c.description || c.campaign || undefined} /> },
    {
      key: 'discount',
      header: 'Discount',
      cell: (c) => (
        <div>
          <span className="font-medium tabular-nums">{c.type === 'percent' ? `${c.value}% off` : `${money(c.value)} off`}</span>
          <p className="text-xs text-muted">
            {[c.type === 'percent' && c.maxDiscountMinor ? `max ${money(c.maxDiscountMinor)}` : '', c.minAmountMinor ? `min ${money(c.minAmountMinor)}` : '', c.newMembersOnly ? 'new members' : ''].filter(Boolean).join(' · ') || 'No conditions'}
          </p>
        </div>
      ),
    },
    {
      key: 'plans',
      header: 'Plans',
      hideOnMobile: true,
      cell: (c) =>
        c.plans?.length ? (
          <div className="flex max-w-[16rem] flex-wrap gap-1">
            {c.plans.map((p) => (
              <Badge key={p}>{planName(p)}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted">All plans</span>
        ),
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: (c) => {
        const used = c.usedCount ?? 0;
        const pct = c.usageLimit ? Math.min(100, (used / c.usageLimit) * 100) : 0;
        return (
          <div className="w-28">
            <p className="text-xs tabular-nums">
              {used}
              {c.usageLimit ? ` / ${c.usageLimit}` : ' uses'} <span className="text-muted">· {c.perUserLimit ?? 1}/member</span>
            </p>
            {c.usageLimit ? (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'validity',
      header: 'Validity',
      hideOnMobile: true,
      cell: (c) => <span className="text-xs tabular-nums text-muted">{c.validFrom || c.validUntil ? `${c.validFrom ? fmtDate(c.validFrom) : 'Now'} → ${c.validUntil ? fmtDate(c.validUntil) : 'No end'}` : 'Always'}</span>,
    },
    { key: 'state', header: 'Status', cell: (c) => <Badge tone={stateTone[couponState(c)]}>{couponState(c)}</Badge> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (c) => (
        <RowActions>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Edit ${c.code}`}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditing(c);
              setFormOpen(true);
            }}
          />
          {c.active ? (
            <Button size="sm" variant="ghost" className="text-danger" aria-label={`Deactivate ${c.code}`} icon={<PowerOff className="h-3.5 w-3.5" />} onClick={() => setDeactivating(c)} />
          ) : (
            <Button size="sm" variant="ghost" aria-label={`Reactivate ${c.code}`} icon={<Power className="h-3.5 w-3.5" />} loading={reactivate.isPending && reactivate.variables?._id === c._id} onClick={() => reactivate.mutate(c)} />
          )}
        </RowActions>
      ),
    },
  ];

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Coupons"
        description="Discount codes for online checkout, with plan restrictions and usage limits."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            New coupon
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          className="w-fit max-w-full"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'all', label: 'All', count: list.data?.length },
            { value: 'active', label: 'Active', count: counts.active ?? 0 },
            { value: 'scheduled', label: 'Scheduled', count: counts.scheduled ?? 0 },
            { value: 'exhausted', label: 'Used up', count: counts.exhausted ?? 0 },
            { value: 'expired', label: 'Expired', count: counts.expired ?? 0 },
            { value: 'inactive', label: 'Inactive', count: counts.inactive ?? 0 },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Code or campaign" label="Search coupons" />
      </div>
      <DataTable
        caption="Coupons"
        columns={columns}
        rows={rows}
        rowKey={(c) => c._id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        empty={
          list.data?.length
            ? { title: 'No coupons match', description: 'Try another filter or search.' }
            : {
                title: 'No coupons yet',
                description: 'Create a code for a campaign, referral partner or seasonal offer.',
                action: (
                  <Button icon={<Tag className="h-4 w-4" />} onClick={openNew}>
                    Create a coupon
                  </Button>
                ),
              }
        }
      />
      <CouponFormModal open={formOpen} coupon={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        loading={deactivate.isPending}
        tone="danger"
        title={`Deactivate ${deactivating?.code}?`}
        description="Members can no longer apply this code. Past redemptions are kept and you can reactivate it later."
        confirmLabel="Deactivate"
      />
    </div>
  );
}
