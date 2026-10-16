import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dayKey } from './utils';

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month calendar heatmap. `days` maps YYYY-MM-DD → number of check-ins. */
export function AttendanceCalendar({ days }: { days: Map<string, number> }) {
  const today = dayKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y, m: m - 1 };
  });
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday start
    const len = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: ({ key: string; d: number } | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= len; d++) out.push({ key: `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, d });
    return out;
  }, [cursor]);
  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthTotal = cells.reduce((a, c) => a + (c && days.get(c.key) ? 1 : 0), 0);
  const isCurrent = today.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`);
  const shift = (n: number) => setCursor((c) => ({ y: c.y + Math.floor((c.m + n) / 12), m: (((c.m + n) % 12) + 12) % 12 }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold">{monthLabel}</p>
          <p className="text-xs text-muted">{monthTotal} active {monthTotal === 1 ? 'day' : 'days'}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 !p-0" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 !p-0" aria-label="Next month" disabled={isCurrent} onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center" role="grid" aria-label={`Check-ins in ${monthLabel}`}>
        {WD.map((w, i) => (
          <span key={i} className="pb-1 text-[0.65rem] font-semibold text-muted" aria-hidden>
            {w}
          </span>
        ))}
        {cells.map((c, i) =>
          c ? (
            <span
              key={c.key}
              role="gridcell"
              aria-label={`${c.key}: ${days.get(c.key) ? 'checked in' : 'no visit'}`}
              className={cn(
                'grid aspect-square place-items-center rounded-lg text-xs tabular-nums transition',
                days.get(c.key) ? (days.get(c.key)! > 1 ? 'bg-primary font-bold text-on-primary' : 'bg-primary/70 font-semibold text-on-primary') : 'bg-fg/[0.04] text-muted',
                c.key === today && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
                c.key > today && 'opacity-40',
              )}
            >
              {c.d}
            </span>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/** Consecutive-day streak ending today or yesterday. */
export function currentStreak(days: Set<string>) {
  let streak = 0;
  let t = Date.now();
  if (!days.has(dayKey(new Date(t)))) t -= 86400000;
  while (days.has(dayKey(new Date(t)))) {
    streak++;
    t -= 86400000;
  }
  return streak;
}
