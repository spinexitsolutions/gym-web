import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, money } from '@/lib/format';
import type { PaymentView } from '@/types/api';
import { MemberSearchSelect, type PickedMember } from './MemberSearchSelect';
import { MoneyInput } from './MoneyInput';
import { usePlansAdmin } from './queries';
import { PAYMENT_METHODS, applyApiErrors, startOfDayIso } from './utils';

const schema = z.object({
  planId: z.string().min(1, 'Choose a plan'),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'complimentary']),
  amountMinor: z.number({ invalid_type_error: 'Enter an amount' }).int().min(0),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  mode: z.enum(['auto', 'upgrade']),
  startDate: z.string().optional(),
});
type Form = z.infer<typeof schema>;

/** Records a front-desk payment (cash/UPI/card…) and grants the membership. */
export function OfflinePaymentModal({ open, onClose, member, onSuccess }: { open: boolean; onClose: () => void; member?: PickedMember | null; onSuccess?: (p: PaymentView) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const plans = usePlansAdmin(open);
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.active), [plans.data]);
  const { control, register, handleSubmit, watch, setValue, reset, setError, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { planId: '', method: 'cash', amountMinor: 0, reference: '', notes: '', mode: 'auto', startDate: '' },
  });
  const [picked, setPicked] = useState<PickedMember | null>(member ?? null);
  const [memberError, setMemberError] = useState<string | undefined>();
  useEffect(() => {
    if (open) {
      reset({ planId: '', method: 'cash', amountMinor: 0, reference: '', notes: '', mode: 'auto', startDate: '' });
      setPicked(member ?? null);
      setMemberError(undefined);
    }
  }, [open, member, reset]);

  const planId = watch('planId');
  const method = watch('method');
  const plan = activePlans.find((p) => p._id === planId || p.id === planId);
  useEffect(() => {
    if (plan) setValue('amountMinor', method === 'complimentary' ? 0 : plan.priceMinor);
  }, [plan, method, setValue]);

  const m = useMutation({
    mutationFn: (f: Form) =>
      api.post<PaymentView>('/payments/offline', {
        userId: picked!.id,
        planId: f.planId,
        method: f.method,
        amountMinor: f.amountMinor,
        reference: f.reference || undefined,
        notes: f.notes || undefined,
        mode: f.mode,
        startDate: f.startDate ? startOfDayIso(f.startDate) : undefined,
      }),
    onSuccess: (p) => {
      toast.success('Payment recorded', `${money(p.amountMinor)} · ${p.planName}${p.receiptNumber ? ` · Receipt ${p.receiptNumber}` : ''}`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onSuccess?.(p);
      onClose();
    },
    onError: (err) => {
      if (!applyApiErrors(err, setError, { amountMinor: 'amountMinor', planId: 'planId' })) toast.error(err);
    },
  });

  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record offline payment"
      description="For payments taken at the front desk. The membership is granted immediately and a receipt is issued."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="offline-payment-form" loading={m.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="offline-payment-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((f) => {
          if (!picked) return setMemberError('Choose a member');
          m.mutate(f);
        }, () => !picked && setMemberError('Choose a member'))}
        noValidate
      >
        <MemberSearchSelect
          className="sm:col-span-2"
          value={picked}
          onChange={(v) => {
            setPicked(v);
            setMemberError(undefined);
          }}
          error={memberError}
        />
        {picked?.membership && (
          <Alert tone="info" className="sm:col-span-2">
            Current: <strong>{picked.membership.planName}</strong> ({picked.membership.status}) until {fmtDate(picked.membership.endDate)}. “Auto” queues the new plan after it ends; “Upgrade” replaces it today.
          </Alert>
        )}
        <Select
          label="Plan"
          required
          wrapClassName="sm:col-span-2"
          placeholder={plans.isLoading ? 'Loading plans…' : 'Choose a plan'}
          options={activePlans.map((p) => ({ value: p._id, label: `${p.name} · ${p.durationDays} days · ${money(p.priceMinor)}${p.isTrial ? ' (trial)' : ''}` }))}
          error={e.planId?.message ?? (plans.isError ? 'Could not load plans' : undefined)}
          {...register('planId')}
        />
        <Select label="Method" required options={PAYMENT_METHODS} error={e.method?.message} {...register('method')} />
        <Controller
          control={control}
          name="amountMinor"
          render={({ field }) => (
            <MoneyInput
              label="Amount received"
              required
              value={field.value}
              onChange={(v) => field.onChange(v ?? 0)}
              max={plan?.priceMinor}
              error={e.amountMinor?.message}
              hint={plan ? `Plan price ${money(plan.priceMinor)} — lower for a discount.` : 'Defaults to the plan price.'}
            />
          )}
        />
        <Select
          label="Mode"
          options={[
            { value: 'auto', label: 'Auto (new or renewal)' },
            { value: 'upgrade', label: 'Upgrade (replace current now)' },
          ]}
          {...register('mode')}
        />
        <Input type="date" label="Start date (optional)" hint="Leave empty to start now / after the current plan." error={e.startDate?.message} {...register('startDate')} />
        <Input label="Reference" placeholder="UPI txn / cheque no. / POS slip" wrapClassName="sm:col-span-2" error={e.reference?.message} {...register('reference')} />
        <Textarea label="Notes" rows={2} wrapClassName="sm:col-span-2" error={e.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
