import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { Availability } from '@/member/components/types';
import { WEEKDAYS } from '@/member/components/utils';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns per-row errors (index → message), including overlaps on the same day. */
export function availabilityErrors(rows: Availability[]): Record<number, string> {
  const e: Record<number, string> = {};
  rows.forEach((r, i) => {
    if (!HHMM.test(r.start) || !HHMM.test(r.end)) e[i] = 'Use HH:MM times';
    else if (r.start >= r.end) e[i] = 'End must be after start';
  });
  rows.forEach((r, i) => {
    if (e[i]) return;
    rows.forEach((o, j) => {
      if (j !== i && !e[j] && o.day === r.day && o.start < r.end && r.start < o.end) e[i] = `Overlaps another ${WEEKDAYS[r.day]} window`;
    });
  });
  return e;
}

/** Weekly availability rows (day / start / end). */
export function AvailabilityEditor({ rows, onChange, errors }: { rows: Availability[]; onChange: (rows: Availability[]) => void; errors: Record<number, string> }) {
  const set = (i: number, patch: Partial<Availability>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted">No availability set — members can’t book 1:1 sessions with you until you add some.</p>}
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-end gap-2">
            <Select aria-label={`Window ${i + 1} day`} wrapClassName="flex-1" value={String(r.day)} onChange={(e) => set(i, { day: Number(e.target.value) })} options={WEEKDAYS.map((d, k) => ({ value: String(k), label: d }))} />
            <Input aria-label={`Window ${i + 1} start`} wrapClassName="w-28" type="time" step={900} value={r.start} onChange={(e) => set(i, { start: e.target.value })} aria-invalid={errors[i] ? true : undefined} />
            <span className="pb-3 text-muted">–</span>
            <Input aria-label={`Window ${i + 1} end`} wrapClassName="w-28" type="time" step={900} value={r.end} onChange={(e) => set(i, { end: e.target.value })} aria-invalid={errors[i] ? true : undefined} />
            <Button variant="ghost" size="sm" className="mb-1 h-9 w-9 !p-0 hover:text-danger" aria-label={`Remove window ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {errors[i] && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors[i]}
            </p>
          )}
        </div>
      ))}
      <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} disabled={rows.length >= 21} onClick={() => onChange([...rows, { day: 1, start: '07:00', end: '12:00' }])}>
        Add window
      </Button>
    </div>
  );
}
