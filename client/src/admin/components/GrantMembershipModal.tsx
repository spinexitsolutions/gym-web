import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, money } from '@/lib/format';
import type { MembershipView } from '@/types/api';
import { usePlansAdmin } from './queries';
import { apiFieldErrors, startOfDayIso } from './utils';

/** POST /memberships — complimentary membership (no payment), reason required and audited. */
export function GrantMembershipModal({ open, onClose, member }: { open: boolean; onClose: () => void; member: { id: string; name: string } }) {
  const qc = useQueryClient();
  const toast = useToast();
  const plans = usePlansAdmin(open);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setPlanId('');
      setStartDate('');
      setReason('');
      setErrors({});
    }
  }, [open]);
  const m = useMutation({
    mutationFn: () => api.post<MembershipView>('/memberships', { userId: member.id, planId, reason: reason.trim(), startDate: startDate ? startOfDayIso(startDate) : undefined }),
    onSuccess: (ms) => {
      toast.success('Membership granted', `${ms.planName}: ${fmtDate(ms.startDate)} → ${fmtDate(ms.endDate)}`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (err) => {
      const fe = apiFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(err);
    },
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!planId) e.planId = 'Choose a plan';
    if (reason.trim().length < 3) e.reason = 'Please give a reason (at least 3 characters)';
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grant complimentary membership"
      description={`For ${member.name}. No payment is recorded.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={m.isPending} onClick={submit}>
            Grant membership
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Alert tone="info">Without a start date, the new plan is queued after any current membership ends.</Alert>
        <Select
          label="Plan"
          required
          placeholder={plans.isLoading ? 'Loading…' : 'Choose a plan'}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          options={(plans.data ?? []).filter((p) => p.active).map((p) => ({ value: p._id, label: `${p.name} · ${p.durationDays} days (${money(p.priceMinor)})` }))}
          error={errors.planId}
        />
        <Input type="date" label="Start date (optional)" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={errors.startDate} />
        <Textarea label="Reason" required rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} placeholder="e.g. Staff family, competition prize, service recovery" />
      </form>
    </Modal>
  );
}
