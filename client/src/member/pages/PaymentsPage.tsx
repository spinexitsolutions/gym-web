import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Download, Receipt, Undo2 } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, useToast } from '@/components/ui';
import { api, download } from '@/lib/api';
import { fmtDate, fmtDateTime, money, titleCase } from '@/lib/format';
import type { PaymentView } from '@/types/api';

const modeLabel = { new: 'New membership', renewal: 'Renewal', upgrade: 'Upgrade' } as const;

export default function PaymentsPage() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['member', 'payments'], queryFn: () => api.get<PaymentView[]>('/payments/me') });

  const receipt = async (p: PaymentView) => {
    setBusy(p.id);
    try {
      await download(`/payments/${p.id}/receipt`, undefined, `${p.receiptNumber ?? 'receipt'}.pdf`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const captured = (q.data ?? []).filter((p) => ['captured', 'partially_refunded', 'refunded'].includes(p.status));
  const totalPaid = captured.reduce((a, p) => a + p.amountMinor - (p.refund?.amountMinor ?? 0), 0);
  const totalSaved = captured.reduce((a, p) => a + (p.discountMinor ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Account" title="Payments & receipts" description="Every payment on your account. Download a PDF receipt for any confirmed payment." />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payments yet" description="When you buy or renew a membership online, the payment and its receipt appear here." action={<ButtonLink to="/member/membership#plans">View plans</ButtonLink>} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Total paid (net)</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(totalPaid)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Saved with coupons</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-success">{money(totalSaved)}</p>
            </div>
          </div>
          <ul className="space-y-3">
            {q.data.map((p, i) => {
              const canReceipt = Boolean(p.receiptNumber && p.capturedAt);
              return (
                <motion.li key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Receipt className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{p.planName}</p>
                        <p className="text-xs text-muted">
                          {modeLabel[p.mode] ?? titleCase(p.mode)} · {fmtDateTime(p.capturedAt ?? p.createdAt)}
                          {p.method ? ` · ${titleCase(p.method)}` : ''}
                        </p>
                        {p.receiptNumber && <p className="mt-0.5 font-mono text-xs text-muted">{p.receiptNumber}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-semibold tabular-nums">{money(p.amountMinor)}</p>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {p.discountMinor > 0 && (
                        <Badge tone="success">
                          {p.couponCode ?? 'Discount'} −{money(p.discountMinor)} (from {money(p.baseAmountMinor)})
                        </Badge>
                      )}
                      {p.refund && (
                        <Badge tone={p.refund.status === 'failed' ? 'danger' : 'warning'}>
                          <Undo2 className="h-3 w-3" /> Refund {money(p.refund.amountMinor)} · {p.refund.status}
                        </Badge>
                      )}
                      {p.status === 'failed' && p.failureReason && <span className="text-danger">{p.failureReason}</span>}
                      {p.status === 'pending' && <span className="text-warning">Awaiting confirmation from your bank</span>}
                      {p.status === 'expired' && <span className="text-muted">Checkout not completed — no money taken</span>}
                    </div>
                    {canReceipt ? (
                      <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} loading={busy === p.id} onClick={() => receipt(p)}>
                        Receipt
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">{p.provider === 'sandbox' ? 'Test payment' : ''}</span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
          <p className="mt-4 text-center text-xs text-muted">Payments from {fmtDate(q.data[q.data.length - 1].createdAt)} onward. Questions about a charge? Open a support ticket.</p>
        </>
      )}
    </div>
  );
}
