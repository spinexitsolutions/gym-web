import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'neutral', className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'neutral' | 'primary' | 'warning' | 'danger' | 'success'; className?: string }) {
  const toneCls = { neutral: 'text-fg', primary: 'text-primary', warning: 'text-warning', danger: 'text-danger', success: 'text-success' }[tone];
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className={cn('mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight', toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string; size?: number; className?: string }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} loading="lazy" className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full bg-primary/15 font-semibold text-primary ring-1 ring-primary/20', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-orientation="horizontal" className={cn('scrollbar-thin flex gap-1 overflow-x-auto rounded-full border border-line bg-fg/[0.03] p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          id={`${id}-${t.value}`}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn('whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition', value === t.value ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i}>
          <dt className="text-xs uppercase tracking-wider text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-sm text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
