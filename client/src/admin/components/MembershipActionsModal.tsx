import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, MoreHorizontal, XCircle, Undo2 } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Alert, Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { MembershipView } from '@/types/api';
import { addDaysLocal, apiFieldErrors, startOfDayIso, toDateInput } from './utils';

export type MembershipAction = 'extend' | 'cancel' | 'set_dates' | 'dismiss_cancellation';

const META: Record<MembershipAction, { title: string; cta: string; tone: 'primary' | 'danger'; desc: string }> = {
  extend: { title: 'Extend membership', cta: 'Extend', tone: 'primary', desc: 'Adds days to the end date (from today if already expired — an expired membership becomes active again).' },
  set_dates: { title: 'Change dates', cta: 'Save dates', tone: 'primary', desc: 'Sets exact start and end dates. Status is recalculated from the dates.' },
  cancel: { title: 'Cancel membership', cta: 'Cancel membership', tone: 'danger', desc: 'Ends access immediately. This does not refund any payment — use Payments → Refund for that.' },
  dismiss_cancellation: { title: 'Dismiss cancellation request', cta: 'Dismiss request', tone: 'primary', desc: 'Keeps the membership running and clears the member’s cancellation request.' },
};

type MembershipLike = Pick<MembershipView, 'id' | 'planName' | 'status' | 'startDate' | 'endDate' | 'cancellationRequestedAt'>;

/** Modal for PATCH /memberships/:id (reason required; audited). */
export function MembershipActionsModal({ membership, action, onClose }: { membership: MembershipLike | null; action: MembershipAction | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const open = Boolean(membership && action);
  const [days, setDays] = useState(30);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open && membership) {
      setDays(30);
      setStart(toDateInput(membership.startDate));
      setEnd(toDateInput(membership.endDate));
      setReason('');
      setErrors({});
    }
  }, [open, membership]);

  const m = useMutation({
    mutationFn: () =>
      api.patch<MembershipView>(`/memberships/${membership!.id}`, {
        action,
        reason: reason.trim(),
        ...(action === 'extend' ? { days } : {}),
        ...(action === 'set_dates' ? { startDate: startOfDayIso(start), endDate: startOfDayIso(end) } : {}),
      }),
    onSuccess: (res) => {
      toast.success(META[action!].title + ' — done', `${res.planName}: ${fmtDate(res.startDate)} → ${fmtDate(res.endDate)} (${res.status})`);
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
    if (reason.trim().length < 3) e.reason = 'Please give a reason (at least 3 characters)';
    if (action === 'extend' && (!Number.isInteger(days) || days < 1 || days > 365)) e.days = 'Between 1 and 365 days';
    if (action === 'set_dates') {
      if (!start) e.startDate = 'Required';
      if (!end) e.endDate = 'Required';
      if (start && end && end <= start) e.endDate = 'End must be after start';
    }
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };

  if (!action) return null;
  const meta = META[action];
  const newEnd = membership && action === 'extend' && days > 0 ? addDaysLocal(new Date(membership.endDate) > new Date() ? new Date(membership.endDate) : new Date(), days) : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={meta.title}
      description={membership ? `${membership.planName} · ${fmtDate(membership.startDate)} → ${fmtDate(membership.endDate)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant={meta.tone === 'danger' ? 'danger' : 'primary'} loading={m.isPending} onClick={submit}>
            {meta.cta}
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
        <Alert tone={meta.tone === 'danger' ? 'warning' : 'info'}>{meta.desc}</Alert>
        {action === 'extend' && (
          <div>
            <Input type="number" label="Days to add" min={1} max={365} required value={days} onChange={(e) => setDays(Number(e.target.value))} error={errors.days} hint={newEnd ? `New end date: ${fmtDate(newEnd)}` : undefined} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[7, 14, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={cn('rounded-full border px-3 py-1 text-xs', days === d ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:text-fg')}>
                  +{d} days
                </button>
              ))}
            </div>
          </div>
        )}
        {action === 'set_dates' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" label="Start date" required value={start} onChange={(e) => setStart(e.target.value)} error={errors.startDate} />
            <Input type="date" label="End date" required value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} error={errors.endDate} />
          </div>
        )}
        <Textarea label="Reason" required rows={3} maxLength={500} placeholder="Recorded in the audit log" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
      </form>
    </Modal>
  );
}

/** Inline action buttons for a membership row; opens MembershipActionsModal. Hidden without members:write. */
export function MembershipActions({ membership, compact }: { membership: MembershipLike; compact?: boolean }) {
  const { can } = useAuth();
  const [action, setAction] = useState<MembershipAction | null>(null);
  const [menu, setMenu] = useState(false);
  if (!can('members:write')) return null;
  const s = membership.status;
  const items: { a: MembershipAction; label: string; icon: JSX.Element; show: boolean; danger?: boolean }[] = [
    { a: 'extend', label: 'Extend', icon: <CalendarPlus className="h-3.5 w-3.5" />, show: ['active', 'upcoming', 'expired'].includes(s) },
    { a: 'set_dates', label: 'Set dates', icon: <CalendarClock className="h-3.5 w-3.5" />, show: ['active', 'upcoming', 'expired'].includes(s) },
    { a: 'dismiss_cancellation', label: 'Dismiss request', icon: <Undo2 className="h-3.5 w-3.5" />, show: Boolean(membership.cancellationRequestedAt) && ['active', 'upcoming'].includes(s) },
    { a: 'cancel', label: 'Cancel', icon: <XCircle className="h-3.5 w-3.5" />, show: ['active', 'upcoming'].includes(s), danger: true },
  ];
  const visible = items.filter((i) => i.show);
  if (!visible.length) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {compact ? (
        <>
          <Button size="sm" variant="ghost" aria-label="Membership actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)} icon={<MoreHorizontal className="h-4 w-4" />} />
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} aria-hidden />
              <ul role="menu" className="absolute right-0 top-full z-30 mt-1 w-48 rounded-theme-sm border border-line bg-surface-2 p-1 shadow-2xl">
                {visible.map((i) => (
                  <li key={i.a} role="none">
                    <button
                      role="menuitem"
                      className={cn('flex w-full items-center gap-2 rounded-theme-sm px-3 py-2 text-left text-sm hover:bg-fg/[0.06]', i.danger && 'text-danger')}
                      onClick={() => {
                        setMenu(false);
                        setAction(i.a);
                      }}
                    >
                      {i.icon}
                      {i.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((i) => (
            <Button key={i.a} size="sm" variant={i.danger ? 'ghost' : 'secondary'} className={cn(i.danger && 'text-danger')} icon={i.icon} onClick={() => setAction(i.a)}>
              {i.label}
            </Button>
          ))}
        </div>
      )}
      <MembershipActionsModal membership={action ? membership : null} action={action} onClose={() => setAction(null)} />
    </div>
  );
}
