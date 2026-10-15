import { useEffect, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';
import type { Ref } from './types';

/** Debounces a fast-changing value (e.g. search input). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Field errors from an API validation error (keys without the body./query. prefix). */
export const apiFieldErrors = (err: unknown): Record<string, string> => (err instanceof ApiError ? err.fieldErrors : {});

/** Maps API validation errors onto react-hook-form fields. Returns true if any were applied. */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, map: Partial<Record<string, Path<T>>> = {}): boolean {
  const fe = apiFieldErrors(err);
  let applied = false;
  for (const [k, message] of Object.entries(fe)) {
    const field = (map[k] ?? k) as Path<T>;
    setError(field, { type: 'server', message });
    applied = true;
  }
  return applied;
}

/** ₹ (major units, as typed by staff) → paise (integer). */
export const toMinor = (rupees: number) => Math.round(rupees * 100);
/** paise → ₹ (number for inputs). */
export const toRupees = (minor: number | null | undefined) => (minor == null ? 0 : minor / 100);

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → value for <input type="date"> in the browser's local time. */
export function toDateInput(d: string | Date | null | undefined) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
/** Date → value for <input type="time">. */
export function toTimeInput(d: string | Date | null | undefined) {
  if (!d) return '';
  const x = new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
/** Local date + time inputs → ISO string. */
export function combineDateTime(date: string, time: string) {
  if (!date) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}
/** Start of local day from a date input. */
export const startOfDayIso = (date: string) => (date ? new Date(`${date}T00:00:00`).toISOString() : undefined);
export const endOfDayIso = (date: string) => (date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined);

export function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** Name of a populated ref or a fallback. */
export const refName = (r: Ref | string | null | undefined, fallback = '—') => (r && typeof r === 'object' ? r.name : fallback);
export const refId = (r: { _id: string } | string | null | undefined) => (r && typeof r === 'object' ? r._id : r ?? '');

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card (POS)' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'complimentary', label: 'Complimentary' },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Trims empty query values so cache keys stay stable. */
export function cleanQuery<T extends Record<string, unknown>>(q: T) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') out[k] = v as string | number | boolean;
  return out;
}
