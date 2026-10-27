import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field, Input } from './Field.jsx';

export function PasswordField({ label = 'Password', name, register, errors, autoComplete = 'current-password', hint, required = true }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={errors?.[name]?.message} hint={hint} required={required}>
      {(a11y) => (
        <div className="relative">
          <Input {...a11y} type={show ? 'text' : 'password'} autoComplete={autoComplete} className="pr-12" {...register(name)} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}
    </Field>
  );
}
