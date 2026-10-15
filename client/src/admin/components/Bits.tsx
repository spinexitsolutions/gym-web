import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/AuthProvider';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { PaymentsStatus } from './types';

/** Shows payment gateway configuration problems (test mode, not configured, webhook missing). */
export function PaymentsStatusBanner({ className }: { className?: string }) {
  const { can } = useAuth();
  const { data } = useQuery({ queryKey: ['admin', 'payments', 'status'], queryFn: () => api.get<PaymentsStatus>('/payments/status'), enabled: can('payments:read'), staleTime: 5 * 60_000 });
  if (!data) return null;
  if (!data.configured)
    return (
      <Alert tone="warning" title="Online payments are not configured" className={className}>
        Members can’t pay online yet. Record payments at the front desk with “Record offline payment”, and configure Razorpay keys on the server to enable checkout.
      </Alert>
    );
  const notes: string[] = [];
  if (data.testMode) notes.push(data.provider === 'sandbox' ? 'The sandbox provider is active — no real money moves.' : 'Razorpay is using test keys — no real money moves.');
  if (!data.webhookConfigured) notes.push('The payment webhook secret is not configured, so late or out-of-band payment confirmations won’t be received.');
  if (!notes.length) return null;
  return (
    <Alert tone={data.webhookConfigured ? 'info' : 'warning'} title={data.testMode ? 'Payments in test mode' : 'Payment webhook not configured'} className={className}>
      {notes.join(' ')}
    </Alert>
  );
}

/** booked / capacity bar with waitlist hint. */
export function CapacityBar({ booked, capacity, waitlist = 0, className }: { booked: number; capacity: number; waitlist?: number; className?: string }) {
  const pct = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  const tone = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  return (
    <div className={cn('min-w-[7rem]', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums text-fg">
          {booked}/{capacity}
        </span>
        {waitlist > 0 && <span className="text-warning">+{waitlist} waitlist</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10" role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={booked} aria-label="Booked capacity">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Small label/value pair for dense headers. */
export function Metric({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Wrapper for row action buttons that should not trigger row click. */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-1', className)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

/** Two-line identity cell. */
export function PersonCell({ name, sub }: { name: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-fg">{name}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}
