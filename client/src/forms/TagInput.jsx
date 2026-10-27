import { useState } from 'react';
import { X } from 'lucide-react';

export function TagInput({ id, value = [], onChange, max = 10, placeholder, suggestions = [], ...a11y }) {
  const [draft, setDraft] = useState('');
  const add = (t) => {
    const tag = t.trim().slice(0, 80);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div>
      <div className="input flex min-h-[48px] flex-wrap items-center gap-2 py-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs text-gold">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="rounded-full hover:text-ink"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input id={id} {...a11y} value={draft} placeholder={value.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
          onBlur={() => add(draft)}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none" />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line/15 px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
