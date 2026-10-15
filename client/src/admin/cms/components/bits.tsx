import { useId, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, Check, CloudOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** "12 / 70" counter that turns amber near and red over the limit. */
export function CharCount({ value, max, className }: { value: string; max: number; className?: string }) {
  const n = value.length;
  return (
    <span className={cn('tabular-nums text-[0.7rem]', n > max ? 'text-danger' : n > max * 0.9 ? 'text-warning' : 'text-muted', className)} aria-live="polite">
      {n} / {max}
    </span>
  );
}

/** Label row with an optional right-aligned slot (counter, action). */
export function LabelRow({ htmlFor, label, right, required }: { htmlFor?: string; label: ReactNode; right?: ReactNode; required?: boolean }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <label htmlFor={htmlFor} className="label !mb-0">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {right}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1 text-xs text-danger">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Hint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-muted">{children}</p>;
}

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
export function SaveIndicator({ state, message }: { state: SaveState; message?: string }) {
  const map = {
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: 'Draft saved', cls: 'text-muted' },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Saving…', cls: 'text-muted' },
    unsaved: { icon: <span className="h-2 w-2 rounded-full bg-warning" />, text: 'Unsaved changes', cls: 'text-warning' },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Save failed', cls: 'text-danger' },
  }[state];
  return (
    <span role="status" title={message} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', map.cls)}>
      {map.icon}
      {map.text}
    </span>
  );
}

/** Compact segmented control (radio group). */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; label: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full border border-line bg-fg/[0.03] p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full font-medium transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-fg/10 text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Labelled range slider with numeric readout. */
export function RangeField({ label, value, onChange, min, max, step = 1, format, error, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div>
      <LabelRow htmlFor={id} label={label} right={<span className="tabular-nums text-xs text-fg/80">{format ? format(value) : value}</span>} />
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[rgb(var(--c-primary))]"
        aria-invalid={error ? true : undefined}
      />
      <FieldError>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
    </div>
  );
}

/** Tag / chip editor: Enter or comma adds, Backspace on empty removes last. */
export function ChipInput({ label, value, onChange, max, maxLength = 30, placeholder = 'Type and press Enter', lowercase, error, hint }: { label: ReactNode; value: string[]; onChange: (v: string[]) => void; max?: number; maxLength?: number; placeholder?: string; lowercase?: boolean; error?: string; hint?: ReactNode }) {
  const id = useId();
  const [text, setText] = useState('');
  const full = max !== undefined && value.length >= max;
  const add = (raw: string) => {
    let t = raw.trim().slice(0, maxLength);
    if (lowercase) t = t.toLowerCase();
    if (!t || value.includes(t) || full) return;
    onChange([...value, t]);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
      setText('');
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div>
      <LabelRow htmlFor={id} label={label} right={max !== undefined ? <span className="text-[0.7rem] text-muted">{value.length} / {max}</span> : undefined} />
      <div className={cn('input flex min-h-[44px] flex-wrap items-center gap-1.5 !py-1.5', error && 'border-danger/80')}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fg/10 py-0.5 pl-2.5 pr-1 text-xs">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 text-muted hover:bg-fg/10 hover:text-fg" aria-label={`Remove ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => {
            if (text) {
              add(text);
              setText('');
            }
          }}
          placeholder={full ? 'Limit reached' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
    </div>
  );
}

/** Small icon-only button for dense toolbars. */
export function IconButton({ label, onClick, children, className, disabled, tone = 'default', ...rest }: { label: string; onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean; tone?: 'default' | 'danger' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-fg/[0.07] hover:text-fg disabled:pointer-events-none disabled:opacity-35', tone === 'danger' && 'hover:bg-danger/10 hover:text-danger', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
