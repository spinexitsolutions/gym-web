import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Avatar, Spinner, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import type { MemberRow } from './types';
import { useDebounced } from './utils';

export interface PickedMember {
  id: string;
  name: string;
  email: string;
  membership?: MemberRow['membership'];
}

interface Props {
  value: PickedMember | null;
  onChange: (m: PickedMember | null) => void;
  label?: string;
  error?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Called on Enter when no result is highlighted (e.g. to treat input as QR). */
  onSubmitRaw?: (text: string) => void;
  className?: string;
}

/** Searchable member combobox (GET /members?q=). Keyboard: ↑/↓ to move, Enter to pick, Esc to close. */
export function MemberSearchSelect({ value, onChange, label = 'Member', error, autoFocus, placeholder = 'Search by name, email or phone', className }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const q = useDebounced(text.trim(), 250);
  const wrap = useRef<HTMLDivElement>(null);
  const { data, isFetching, isError } = useQuery({
    queryKey: ['admin', 'members', 'search', q],
    queryFn: () => api.get<MemberRow[]>('/members', { q, limit: 8 }),
    enabled: q.length >= 2 && !value,
    staleTime: 30_000,
  });
  const results = data ?? [];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => setHi(0), [q]);

  const pick = (m: MemberRow) => {
    onChange({ id: m.id, name: m.name, email: m.email, membership: m.membership });
    setText('');
    setOpen(false);
  };

  if (value) {
    return (
      <div className={className}>
        {label && <p className="label">{label}</p>}
        <div className="flex items-center gap-3 rounded-theme-sm border border-line bg-fg/[0.03] px-3 py-2.5">
          <Avatar name={value.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="truncate text-xs text-muted">{value.email}</p>
          </div>
          <button type="button" className="rounded-full p-1.5 text-muted hover:bg-fg/5 hover:text-fg" aria-label="Change member" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const listId = `${id}-list`;
  const showList = open && q.length >= 2;
  return (
    <div ref={wrap} className={cn('relative', className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[hi] ? `${id}-opt-${hi}` : undefined}
          aria-invalid={error ? true : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          className="input pl-10"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && showList && results[hi]) {
              e.preventDefault();
              pick(results[hi]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <Spinner className="h-4 w-4" />
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      {showList && (
        <ul id={listId} role="listbox" className="scrollbar-thin absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-theme-sm border border-line bg-surface-2 p-1 shadow-2xl">
          {isError && <li className="px-3 py-2.5 text-sm text-danger">Search failed. Try again.</li>}
          {!isFetching && !isError && results.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No members match “{q}”.</li>}
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className={cn('flex cursor-pointer items-center gap-3 rounded-theme-sm px-3 py-2', i === hi && 'bg-fg/[0.06]')}
            >
              <Avatar name={m.name} src={m.avatarUrl || undefined} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted">
                  {m.email}
                  {m.phone ? ` · ${m.phone}` : ''}
                </p>
              </div>
              {m.membership ? (
                <span className="hidden text-right text-xs text-muted sm:block">
                  <StatusBadge status={m.membership.status} />
                  <span className="mt-0.5 block">to {fmtDate(m.membership.endDate)}</span>
                </span>
              ) : (
                <span className="text-xs text-muted">No plan</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
