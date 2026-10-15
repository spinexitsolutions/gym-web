import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, FileDown, RotateCcw } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Alert, Button, KeyValue, Modal, StatusBadge, Switch, Textarea, useToast } from '@/components/ui';
import { api, download } from '@/lib/api';
import { fmtDateTime, money, titleCase } from '@/lib/format';
import type { PaymentView } from '@/types/api';
import { MoneyInput } from './MoneyInput';
import type { AdminPayment } from './types';
import { apiFieldErrors } from './utils';

export const refundableMinor = (p: PaymentView) => p.amountMinor - (p.refund?.amountMinor ?? 0);
export const canRefund = (p: PaymentView) => ['captured', 'partially_refunded'].includes(p.status) && refundableMinor(p) > 0 && !(p.refund && ['processing', 'requested'].includes(p.refund.status));

export async function downloadReceipt(p: PaymentView, onError: (e: unknown) => void) {
  try {
    await download(`/payments/${p.id}/receipt`, undefined, `receipt-${p.receiptNumber ?? p.id}.pdf`);
  } catch (err) {
    onError(err);
  }
}

/** POST /payments/:id/refund — amount in ₹ (defaults to the full refundable amount). */
export function RefundModal({ payment, onClose }: { payment: PaymentView | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const max = payment ? refundableMinor(payment) : 0;
  const [amount, setAmount] = useState<number | null>(max);
  const [reason, setReason] = useState('');
  const [cancelMembership, setCancel] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (payment) {
      setAmount(refundableMinor(payment));
      setReason('');
      setCancel(false);
      setErrors({});
    }
  }, [payment]);
  const m = useMutation({
    mutationFn: () => api.post<PaymentView>(`/payments/${payment!.id}/refund`, { amountMinor: amount ?? undefined, reason: reason.trim(), cancelMembership }),
    onSuccess: (p) => {
      toast.success('Refund initiated', `${money(p.refund?.amountMinor ?? amount ?? 0)} · status ${p.refund?.status ?? p.status}`);
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
    if (!amount || amount < 1) e.amountMinor = 'Enter an amount';
    else if (amount > max) e.amountMinor = `At most ${money(max)}`;
    if (reason.trim().length < 3) e.reason = 'Please give a reason (at least 3 characters)';
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <Modal
      open={Boolean(payment)}
      onClose={onClose}
      size="sm"
      title="Refund payment"
      description={payment ? `${payment.planName} · paid ${money(payment.amountMinor)}${payment.receiptNumber ? ` · ${payment.receiptNumber}` : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={m.isPending} onClick={submit}>
            Refund {amount ? money(amount) : ''}
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
        {payment?.provider === 'offline' ? (
          <Alert tone="info">Offline payment — the refund is recorded here; hand the money back to the member at the desk.</Alert>
        ) : (
          <Alert tone="warning">The refund is sent to the payment gateway and returns to the member’s original payment method.</Alert>
        )}
        <MoneyInput label="Refund amount" required value={amount} onChange={setAmount} max={max} error={errors.amountMinor} hint={`Refundable: ${money(max)}`} />
        <Textarea label="Reason" required rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} placeholder="Recorded in the audit log" />
        <Switch checked={cancelMembership} onChange={setCancel} label="Also cancel the membership" description="Ends the linked membership immediately." />
      </form>
    </Modal>
  );
}

function CopyValue({ value }: { value: string | null }) {
  const toast = useToast();
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <code className="truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        aria-label="Copy"
        className="shrink-0 text-muted hover:text-fg"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => toast.info('Copied'));
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Payment detail with all references, receipt download and refund entry point. */
export function PaymentDetailModal({ payment, onClose, onRefund }: { payment: AdminPayment | null; onClose: () => void; onRefund: (p: AdminPayment) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const p = payment;
  return (
    <Modal
      open={Boolean(p)}
      onClose={onClose}
      size="lg"
      title={p ? `${money(p.amountMinor)} · ${p.planName}` : 'Payment'}
      description={p ? `Created ${fmtDateTime(p.createdAt)}` : undefined}
      footer={
        p && (
          <>
            {p.receiptNumber && p.capturedAt && (
              <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadReceipt(p, toast.error)}>
                Receipt PDF
              </Button>
            )}
            {can('payments:write') && canRefund(p) && (
              <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => onRefund(p)}>
                Refund
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        )
      }
    >
      {p && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <span className="text-sm text-muted">
              {titleCase(p.provider)}
              {p.method ? ` · ${titleCase(p.method)}` : ''} · {titleCase(p.mode)}
            </span>
          </div>
          {p.failureReason && <Alert tone="danger" title="Failure reason">{p.failureReason}</Alert>}
          <section>
            <h3 className="eyebrow mb-3">Member</h3>
            {p.user ? (
              <Link to={`/admin/members/${p.user._id}`} className="text-sm font-medium text-primary hover:underline" onClick={onClose}>
                {p.user.name} <span className="text-muted">· {p.user.email}</span>
              </Link>
            ) : (
              <p className="text-sm text-muted">Unknown member</p>
            )}
          </section>
          <section>
            <h3 className="eyebrow mb-3">Amounts</h3>
            <KeyValue
              items={[
                { label: 'Base price', value: money(p.baseAmountMinor) },
                { label: 'Discount', value: p.discountMinor ? `− ${money(p.discountMinor)}${p.couponCode ? ` (${p.couponCode})` : ''}` : '—' },
                { label: 'Charged', value: <strong>{money(p.amountMinor)}</strong> },
                { label: 'Refunded', value: p.refund ? `${money(p.refund.amountMinor)} · ${p.refund.status}` : '—' },
              ]}
            />
          </section>
          <section>
            <h3 className="eyebrow mb-3">References</h3>
            <KeyValue
              items={[
                { label: 'Receipt number', value: <CopyValue value={p.receiptNumber} /> },
                { label: 'Order ID', value: <CopyValue value={p.orderId} /> },
                { label: 'Provider payment ID', value: <CopyValue value={p.providerPaymentId} /> },
                { label: 'Internal ID', value: <CopyValue value={p.id} /> },
                { label: 'Captured at', value: fmtDateTime(p.capturedAt) },
                { label: 'Membership', value: p.membership ? <CopyValue value={p.membership} /> : '—' },
              ]}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
