import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { AvailabilitySlot } from './types';
import { WEEKDAYS } from './utils';

/** Weekly availability rows (day + start/end). Server allows up to 21 rows; end must be after start. */
export function AvailabilityEditor({ value, onChange, error }: { value: AvailabilitySlot[]; onChange: (v: AvailabilitySlot[]) => void; error?: string }) {
  const set = (i: number, patch: Partial<AvailabilitySlot>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const sorted = value.map((s, i) => ({ s, i }));
  return (
    <fieldset>
      <legend className="label">Weekly availability</legend>
      <p className="mb-2 text-xs text-muted">Used for personal-training slot booking. Add several rows for split shifts.</p>
      {value.length === 0 && <p className="mb-2 rounded-theme-sm border border-dashed border-line px-3 py-3 text-sm text-muted">No availability — members can’t book PT with this trainer.</p>}
      <ul className="space-y-2">
        {sorted.map(({ s, i }) => {
          const bad = s.start >= s.end;
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`av-day-${i}`}>
                Day
              </label>
              <select id={`av-day-${i}`} className="input w-28 py-2" value={s.day} onChange={(e) => set(i, { day: Number(e.target.value) })}>
                {WEEKDAYS.map((d, n) => (
                  <option key={d} value={n}>
                    {d}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`av-start-${i}`}>
                Start
              </label>
              <input id={`av-start-${i}`} type="time" className="input w-32 py-2" value={s.start} onChange={(e) => set(i, { start: e.target.value })} aria-invalid={bad || undefined} />
              <span className="text-xs text-muted">to</span>
              <label className="sr-only" htmlFor={`av-end-${i}`}>
                End
              </label>
              <input id={`av-end-${i}`} type="time" className="input w-32 py-2" value={s.end} onChange={(e) => set(i, { end: e.target.value })} aria-invalid={bad || undefined} />
              <Button size="sm" variant="ghost" className="!px-2 text-danger" aria-label="Remove row" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {bad && <span className="text-xs text-danger">End must be after start</span>}
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2"
        icon={<Plus className="h-3.5 w-3.5" />}
        disabled={value.length >= 21}
        onClick={() => {
          const last = value[value.length - 1];
          onChange([...value, last ? { ...last, day: (last.day + 1) % 7 } : { day: 1, start: '07:00', end: '12:00' }]);
        }}
      >
        Add slot
      </Button>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
