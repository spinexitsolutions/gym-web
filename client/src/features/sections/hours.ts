import type { SiteSettings } from '@apex/shared';

export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

type Hours = SiteSettings['hours'];

/** Weekday key ('mon'…) for "now" in the gym's timezone. */
export function todayKey(timezone = 'Asia/Kolkata'): (typeof DAY_ORDER)[number] {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(new Date()).toLowerCase().slice(0, 3);
    return (DAY_ORDER as readonly string[]).includes(wd) ? (wd as (typeof DAY_ORDER)[number]) : 'mon';
  } catch {
    return DAY_ORDER[(new Date().getDay() + 6) % 7];
  }
}

/** "05:30" → "5:30 am" */
export function fmtClock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

export function sortedHours(hours: Hours) {
  return [...hours].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

/** Short summary for today, e.g. "Open today · 5:30 am – 10:30 pm". */
export function todaySummary(hours: Hours | undefined, timezone?: string): string | null {
  if (!hours?.length) return null;
  const t = hours.find((h) => h.day === todayKey(timezone));
  if (!t) return null;
  return t.closed ? 'Closed today' : `Open today · ${fmtClock(t.open)} – ${fmtClock(t.close)}`;
}

/** Compresses consecutive days with identical hours: "Mon – Fri". */
export function groupedHours(hours: Hours) {
  const out: { label: string; value: string; days: string[] }[] = [];
  for (const h of sortedHours(hours)) {
    const value = h.closed ? 'Closed' : `${fmtClock(h.open)} – ${fmtClock(h.close)}`;
    const last = out[out.length - 1];
    if (last && last.value === value) last.days.push(h.day);
    else out.push({ label: '', value, days: [h.day] });
  }
  for (const g of out) {
    const first = DAY_LABEL[g.days[0] as keyof typeof DAY_LABEL].slice(0, 3);
    const lastDay = DAY_LABEL[g.days[g.days.length - 1] as keyof typeof DAY_LABEL].slice(0, 3);
    g.label = g.days.length > 1 ? `${first} – ${lastDay}` : first;
  }
  return out;
}

export function fullAddress(c: SiteSettings['contact']) {
  return [c.addressLine, c.city, [c.region, c.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function directionsUrl(s: Pick<SiteSettings, 'contact' | 'location'>) {
  if (s.location.directionsUrl) return s.location.directionsUrl;
  const q = s.location.lat != null && s.location.lng != null ? `${s.location.lat},${s.location.lng}` : fullAddress(s.contact);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}
