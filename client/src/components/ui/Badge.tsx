import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-fg/8 text-fg/80 ring-fg/10',
  primary: 'bg-primary/12 text-primary ring-primary/25',
  success: 'bg-success/12 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  danger: 'bg-danger/12 text-danger ring-danger/25',
  info: 'bg-sky-400/12 text-sky-300 ring-sky-400/25',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

const statusTones: Record<string, Tone> = {
  active: 'success',
  captured: 'success',
  confirmed: 'success',
  attended: 'success',
  published: 'success',
  approved: 'success',
  resolved: 'success',
  upcoming: 'info',
  pending: 'warning',
  waitlisted: 'warning',
  in_progress: 'info',
  open: 'warning',
  created: 'neutral',
  draft: 'neutral',
  expired: 'neutral',
  unpublished: 'neutral',
  closed: 'neutral',
  upgraded: 'neutral',
  partially_refunded: 'warning',
  refunded: 'danger',
  failed: 'danger',
  cancelled: 'danger',
  suspended: 'danger',
  rejected: 'danger',
  no_show: 'danger',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTones[status] ?? 'neutral'} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
