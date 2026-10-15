import type { FieldValues, Path, Resolver, UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '@/lib/api';

/** The gym's IANA timezone (set by SiteProvider from published settings). */
export const gymTz = () => (window as unknown as { __APEX_TZ__?: string }).__APEX_TZ__ ?? 'Asia/Kolkata';

/** YYYY-MM-DD for a date in the gym's timezone. */
export function dayKey(d: string | Date, tz = gymTz()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}

/** Today's YYYY-MM-DD in the gym's timezone, shifted by `offsetDays`. */
export function todayKey(offsetDays = 0) {
  return dayKey(new Date(Date.now() + offsetDays * 86400000));
}

/** Value for <input type="date"> from an ISO string (local calendar date). */
export function toDateInput(d?: string | Date | null) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Copies server field errors onto a react-hook-form instance. Returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, map: Record<string, string> = {}) {
  if (!(err instanceof ApiError)) return false;
  const fe = err.fieldErrors;
  let applied = false;
  for (const [path, message] of Object.entries(fe)) {
    const key = map[path] ?? path;
    setError(key as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}

/** Optional number from a text/number input value. */
export const optNum = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: gymTz(), hour: 'numeric', hour12: false }).format(new Date()));
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const firstName = (name?: string) => (name ?? '').split(/\s+/)[0] || 'there';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Fade-up motion preset with optional stagger index. */
export const fadeUp = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: Math.min(i, 10) * 0.05, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
});

export const LEVELS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

/** zodResolver typed to the schema's *output* (inputs are strings from the DOM; the resolver returns parsed values). */
export const zr = <T extends FieldValues>(schema: ZodTypeAny) => zodResolver(schema) as unknown as Resolver<T>;
