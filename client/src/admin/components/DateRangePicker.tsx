import { useId } from 'react';
import { cn } from '@/lib/cn';
import { addDaysLocal, toDateInput } from './utils';

export interface DateRange {
  /** YYYY-MM-DD (local) or '' */
  from: string;
  to: string;
}

export const presetRange = (days: number): DateRange => ({ from: toDateInput(addDaysLocal(new Date(), -days + 1)), to: toDateInput(new Date()) });

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '12M', days: 365 },
];

/** From/to date inputs with quick presets. */
export function DateRangePicker({ value, onChange, presets = true, className, label = 'Date range' }: { value: DateRange; onChange: (r: DateRange) => void; presets?: boolean; className?: string; label?: string }) {
  const id = useId();
  const active = PRESETS.find((p) => {
    const r = presetRange(p.days);
    return r.from === value.from && r.to === value.to;
  });
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-from`} className="sr-only">
          From
        </label>
        <input id={`${id}-from`} type="date" className="input w-[9.75rem] py-2" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        <span className="text-xs text-muted">to</span>
        <label htmlFor={`${id}-to`} className="sr-only">
          To
        </label>
        <input id={`${id}-to`} type="date" className="input w-[9.75rem] py-2" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        {presets && (
          <div className="flex gap-1 rounded-full border border-line bg-fg/[0.03] p-1" role="group" aria-label="Quick ranges">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={active?.label === p.label}
                onClick={() => onChange(presetRange(p.days))}
                className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition', active?.label === p.label ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg')}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
