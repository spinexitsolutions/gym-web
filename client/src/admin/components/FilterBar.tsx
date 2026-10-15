import { useId, type ReactNode } from 'react';
import { Download, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button, useToast } from '@/components/ui';
import { download } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Horizontal filter toolbar; wraps and stacks on mobile. */
export function FilterBar({ children, className, actions }: { children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string }) {
  const id = useId();
  return (
    <div className={cn('lg:w-72', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id={id} type="search" className="input pl-10 pr-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Compact select for filter bars (label visually hidden but accessible). */
export function FilterSelect<T extends string>({ label, value, onChange, options, className }: { label: string; value: T | ''; onChange: (v: T | '') => void; options: { value: T; label: string }[]; className?: string }) {
  const id = useId();
  return (
    <div className={cn('lg:w-48', className)}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T | '')}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Downloads a CSV/PDF from an authenticated endpoint with loading + error toast. */
export function ExportButton({ path, query, filename, label = 'Export CSV', size = 'md', variant = 'secondary' }: { path: string; query?: Record<string, string | number | boolean | undefined | null>; filename: string; label?: string; size?: 'sm' | 'md'; variant?: 'secondary' | 'ghost' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      icon={<Download className="h-4 w-4" />}
      onClick={async () => {
        setBusy(true);
        try {
          await download(path, { ...query, format: 'csv' }, filename);
        } catch (err) {
          toast.error(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
