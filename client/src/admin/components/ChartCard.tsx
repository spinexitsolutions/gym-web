import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, ErrorState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';

/** Theme-aware colours for SVG charts (CSS variables resolve at paint time). */
export const chart = {
  primary: 'rgb(var(--c-primary))',
  primarySoft: 'rgb(var(--c-primary) / 0.18)',
  accent: 'rgb(var(--c-grad-to))',
  secondary: 'rgb(var(--c-secondary))',
  success: 'rgb(var(--c-success))',
  warning: 'rgb(var(--c-warning))',
  danger: 'rgb(var(--c-danger))',
  muted: 'rgb(var(--c-muted))',
  grid: 'rgb(var(--c-border) / 0.7)',
  text: 'rgb(var(--c-text))',
  surface: 'rgb(var(--c-surface))',
  /** Categorical series palette. */
  series: ['rgb(var(--c-primary))', 'rgb(var(--c-grad-to))', 'rgb(var(--c-warning))', 'rgb(var(--c-secondary))', 'rgb(var(--c-danger))', 'rgb(var(--c-success))', 'rgb(var(--c-muted))'],
};

export const axisProps = {
  stroke: chart.muted,
  tick: { fill: chart.muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const tooltipProps = {
  contentStyle: { background: chart.surface, border: '1px solid rgb(var(--c-border))', borderRadius: 12, fontSize: 12, color: chart.text, boxShadow: '0 10px 30px -10px rgb(0 0 0 / 0.5)' },
  labelStyle: { color: chart.muted, marginBottom: 4 },
  itemStyle: { color: chart.text, padding: 0 },
  cursor: { fill: 'rgb(var(--c-text) / 0.04)', stroke: 'rgb(var(--c-text) / 0.12)' },
} as const;

/** Compact ₹ for axes: ₹1.2L, ₹12k. */
export function moneyAxis(minor: number) {
  const r = minor / 100;
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (Math.abs(r) >= 1e3) return `₹${(r / 1e3).toFixed(0)}k`;
  return `₹${r}`;
}
export const moneyTooltip = (v: number) => money(v);

/** Shortens period keys (2026-10-03 → 3 Oct, 2026-W40 → W40, 2026-10 → Oct 26). */
export function periodLabel(p: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return new Date(`${p}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (/^\d{4}-W\d{2}$/.test(p)) return p.slice(5);
  if (/^\d{4}-\d{2}$/.test(p)) return new Date(`${p}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return p;
}

interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  height?: number;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Card wrapper for a chart with loading / error / empty states built in. */
export function ChartCard({ title, description, action, isLoading, error, onRetry, isEmpty, emptyText = 'No data for this period yet.', height = 260, className, children, footer }: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader title={title} description={description} action={action} />
      <div className="flex-1 px-3 pb-4 pt-4 sm:px-5">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} className="py-8" />
        ) : isLoading ? (
          <div style={{ height }}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : isEmpty ? (
          <div className="grid place-items-center rounded-theme-sm border border-dashed border-line text-center text-sm text-muted" style={{ height }}>
            <div>
              <BarChart3 className="mx-auto mb-2 h-5 w-5 opacity-60" />
              {emptyText}
            </div>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
      {footer}
    </Card>
  );
}

/** Small inline legend. */
export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value !== undefined && <span className="font-medium tabular-nums text-fg">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Fills missing daily periods (YYYY-MM-DD) with zero rows so sparse series render continuously. */
export function fillDaily<T extends { period: string }>(rows: T[], from: Date, to: Date, zero: (period: string) => T): T[] {
  const map = new Map(rows.map((r) => [r.period, r]));
  const out: T[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  let guard = 0;
  while (d <= end && guard++ < 800) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(map.get(key) ?? zero(key));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
