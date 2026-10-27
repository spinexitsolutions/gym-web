import { forwardRef, useId } from 'react';
import { cn } from '../utils/cn.js';

// Label + control + hint/error, wired for screen readers.
export function Field({ label, error, hint, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted">
          {label}{required && <span className="text-gold" aria-hidden> *</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('input', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('input min-h-[120px] resize-y', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={cn('input appearance-none pr-10', className)} {...props}>{children}</select>;
});

// Convenience: <TextField label name register errors />
export function TextField({ label, name, register, errors, hint, required, as = 'input', options, ...props }) {
  const Comp = as === 'textarea' ? Textarea : as === 'select' ? Select : Input;
  return (
    <Field label={label} error={errors?.[name]?.message} hint={hint} required={required}>
      {(a11y) => (
        <Comp {...a11y} {...register(name)} {...props}>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Comp>
      )}
    </Field>
  );
}

export function FormAlert({ tone = 'danger', children }) {
  if (!children) return null;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-brand border px-4 py-3 text-sm', tone === 'danger' ? 'border-danger/40 bg-danger/10 text-danger' : 'border-success/40 bg-success/10 text-success')}>
      {children}
    </div>
  );
}

// Applies server-side validation errors to react-hook-form fields; returns any message not tied to a field.
export function applyServerErrors(err, setError) {
  const fields = err?.fieldErrors?.() || {};
  Object.entries(fields).forEach(([name, message]) => setError(name, { type: 'server', message }));
  return Object.keys(fields).length ? null : err?.message || 'Something went wrong';
}
