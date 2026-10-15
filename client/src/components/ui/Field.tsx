import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldWrapProps {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}

export function FieldWrap({ label, error, hint, id, children, className, required }: FieldWrapProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label?: ReactNode; error?: string; hint?: ReactNode; wrapClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(function Input({ label, error, hint, wrapClassName, className, id, required, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} className={wrapClassName} required={required}>
      <input ref={ref} id={fid} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined} className={cn('input', className)} {...rest} />
    </FieldWrap>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea({ label, error, hint, wrapClassName, className, id, required, rows = 4, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} className={wrapClassName} required={required}>
      <textarea ref={ref} id={fid} rows={rows} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-error` : undefined} className={cn('input resize-y', className)} {...rest} />
    </FieldWrap>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Common & { options: { value: string; label: string }[]; placeholder?: string }>(function Select(
  { label, error, hint, wrapClassName, className, id, options, placeholder, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} error={error} hint={hint} id={fid} className={wrapClassName} required={required}>
      <select ref={ref} id={fid} required={required} aria-invalid={error ? true : undefined} className={cn('input appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b929b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")" }} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }>(function Checkbox({ label, error, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="flex cursor-pointer items-start gap-3 text-sm text-fg/90">
        <input ref={ref} id={fid} type="checkbox" aria-invalid={error ? true : undefined} className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-bg accent-[rgb(var(--c-primary))]" {...rest} />
        <span>{label}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

export function Switch({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={fid} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-primary' : 'bg-fg/15')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}
