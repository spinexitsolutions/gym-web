import { forwardRef, useEffect, useId, useState, type ReactNode } from 'react';
import { FieldWrap } from '@/components/ui';
import { cn } from '@/lib/cn';

interface Props {
  label?: ReactNode;
  /** Value in paise (minor units). null = empty. */
  value: number | null | undefined;
  onChange: (minor: number | null) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  max?: number;
  id?: string;
}

/** Rupee input that stores paise. Staff type ₹ amounts (up to 2 decimals); the value is an integer in paise. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput({ label, value, onChange, error, hint, required, disabled, placeholder = '0', className, max, id }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  const fmt = (m: number | null | undefined) => (m == null ? '' : String(m / 100));
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    // Sync when the value changes from outside (e.g. plan default price).
    const parsed = text === '' ? null : Math.round(Number(text) * 100);
    if (parsed !== (value ?? null)) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} className={className} required={required}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
        <input
          ref={ref}
          id={fid}
          inputMode="decimal"
          className={cn('input pl-8 tabular-nums')}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '');
            if (!/^\d*(\.\d{0,2})?$/.test(v)) return;
            setText(v);
            if (v === '' || v === '.') return onChange(null);
            let minor = Math.round(Number(v) * 100);
            if (max !== undefined && minor > max) minor = max;
            onChange(minor);
          }}
        />
      </div>
    </FieldWrap>
  );
});
