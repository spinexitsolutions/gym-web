import { useId, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { FieldWrap } from '@/components/ui';

/** Tag/chip editor for short string lists. Enter or comma adds; Backspace on empty removes last. */
export function ChipsInput({ label, value, onChange, placeholder = 'Type and press Enter', max = 12, maxLength = 80, error, hint }: { label?: ReactNode; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; maxLength?: number; error?: string; hint?: ReactNode }) {
  const id = useId();
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const v = raw.trim().slice(0, maxLength);
    if (!v || value.includes(v) || value.length >= max) return;
    onChange([...value, v]);
    setText('');
  };
  return (
    <FieldWrap label={label} error={error} hint={hint ?? `${value.length}/${max}`} id={id}>
      <div className="input flex min-h-[2.75rem] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/12 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/25">
            {v}
            <button type="button" aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-primary/20" onClick={() => onChange(value.filter((x) => x !== v))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          value={text}
          placeholder={value.length >= max ? 'Limit reached' : placeholder}
          disabled={value.length >= max}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text && add(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
        />
      </div>
    </FieldWrap>
  );
}
