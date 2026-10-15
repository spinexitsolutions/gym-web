import { formatMoney } from '@apex/shared';

export const money = (minor: number | null | undefined) => formatMoney(minor ?? 0);

const tz = () => (window as unknown as { __APEX_TZ__?: string }).__APEX_TZ__ ?? 'Asia/Kolkata';

export function fmtDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz(), ...opts }).format(new Date(d));
}
export const fmtDateTime = (d: string | Date | null | undefined) => fmtDate(d, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtTime = (d: string | Date | null | undefined) => fmtDate(d, { hour: 'numeric', minute: '2-digit' });
export const fmtWeekday = (d: string | Date) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

export function relativeTime(d: string | Date) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
