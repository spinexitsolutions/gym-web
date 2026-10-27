import { Search } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { Badge } from '../ui/Badge.jsx';

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', loading }) {
  return (
    <div className="rounded-brand border border-line/10 bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        {Icon && <span className={cn('grid h-9 w-9 place-items-center rounded-full', tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-gold/10 text-gold')}><Icon className="h-4 w-4" aria-hidden /></span>}
      </div>
      {loading ? <div className="skeleton mt-3 h-8 w-24" /> : <p className="mt-3 font-display text-3xl font-semibold">{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }) {
  return (
    <section className={cn('rounded-brand border border-line/10 bg-surface', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-4">
          {title && <h2 className="font-sans text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className, label = 'Search' }) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" aria-label={label} className="input h-10 py-2 pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <label className={cn('flex items-center gap-2 text-xs text-muted', className)}>
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select className="input h-10 w-auto py-2 pr-8" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Toolbar({ children }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

const STATUS_TONES = {
  active: 'success', paid: 'success', published: 'success', booked: 'success', completed: 'success', resolved: 'success', approved: 'success', scheduled: 'success', subscribed: 'success',
  pending: 'gold', waitlisted: 'gold', open: 'gold', new: 'gold', in_progress: 'gold', refund_requested: 'gold', draft: 'neutral', requested: 'gold', created: 'neutral',
  expired: 'neutral', cancelled: 'neutral', closed: 'neutral', refunded: 'neutral', archived: 'neutral', spam: 'neutral', none: 'neutral',
  suspended: 'danger', failed: 'danger', rejected: 'danger', no_show: 'danger', deleted: 'danger',
};

export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge tone={STATUS_TONES[status] || 'neutral'}>{String(status).replace(/_/g, ' ')}</Badge>;
}

export function ChartCard({ title, children, actions, height = 280, className }) {
  return (
    <Card title={title} actions={actions} className={className}>
      <div style={{ height }} className="w-full">{children}</div>
    </Card>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-line/5 pb-2 sm:block sm:border-0 sm:pb-0">
          <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
          <dd className="mt-0.5 text-right sm:text-left">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
