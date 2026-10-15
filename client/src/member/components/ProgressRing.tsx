import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

/** Circular progress indicator. `value` is 0..1. Colour follows the theme primary. */
export function ProgressRing({ value, size = 120, stroke = 10, children, className, label, tone = 'primary' }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string; label?: string; tone?: 'primary' | 'warning' | 'danger' }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { primary: 'rgb(var(--c-primary))', warning: 'rgb(var(--c-warning))', danger: 'rgb(var(--c-danger))' }[tone];
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-text) / 0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color.replace(')', ' / 0.45)')})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Thin horizontal progress bar. */
export function ProgressBar({ value, className, tone = 'primary', label }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning'; label?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const bg = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-fg/[0.08]', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <motion.div className={cn('h-full rounded-full', bg)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} />
    </div>
  );
}
