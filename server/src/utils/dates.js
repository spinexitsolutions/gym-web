import env from '../config/env.js';

// YYYY-MM-DD for `date` in the gym's time zone.
export function gymDay(date = new Date(), tz = env.GYM_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // clamp 31 Jan + 1 month to end of Feb
  return d;
}

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * 864e5);
export const startOfDayUtc = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// Offset (minutes) of a time zone at a given instant, e.g. +330 for Asia/Kolkata.
export function tzOffsetMinutes(date, tz = env.GYM_TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// Converts a gym-local date + 'HH:mm' to a UTC Date.
export function gymLocalToUtc(day, hhmm, tz = env.GYM_TIMEZONE) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60000);
}

// Day of week (0 = Sunday) of a YYYY-MM-DD string.
export const dayOfWeek = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

export const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmmOf = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
