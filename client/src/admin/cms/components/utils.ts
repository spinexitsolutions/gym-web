import { useEffect, useRef } from 'react';
import { RESERVED_SLUGS, slugSchema } from '@apex/shared';
import type { MediaAsset } from './types';

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Paths handled by dedicated public routes; a CMS page with this slug would never be reached. */
export const SHADOWED_SLUGS = ['programs', 'trainers', 'memberships', 'schedule', 'contact', 'unsubscribe'];

/** Returns an error message for an invalid page slug, or undefined. */
export function pageSlugError(slug: string): string | undefined {
  if (!slug) return 'Slug is required';
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Invalid slug';
  if (RESERVED_SLUGS.includes(slug)) return `“${slug}” is reserved by the app`;
  return undefined;
}

export function formatBytes(n: number | undefined): string {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Smallest variant at least `min` px wide, falling back to the original. */
export function thumbUrl(a: Pick<MediaAsset, 'url' | 'variants'>, min = 480): string {
  const vs = [...(a.variants ?? [])].sort((x, y) => x.width - y.width);
  return vs.find((v) => v.width >= min)?.url ?? vs[vs.length - 1]?.url ?? a.url;
}

/** ISO string → value for <input type="datetime-local"> (local time). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function localInputToIso(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/* ------------------------------- Colour maths ------------------------------ */

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function relLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  if (!HEX_RE.test(a) || !HEX_RE.test(b)) return 21;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mirrors themeToCssVars' on-primary choice. */
export const onPrimaryFor = (primary: string) => (relLuminance(primary) > 0.45 ? '#08090b' : '#ffffff');

/* ---------------------------------- Hooks ---------------------------------- */

/** Warn before closing/reloading the tab, and before following in-app links, while `when` is true. */
export function useUnsavedChangesWarning(when: boolean, message = 'You have unsaved changes. Leave this page anyway?') {
  const ref = useRef(when);
  ref.current = when;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!ref.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    // BrowserRouter has no blocker API, so intercept in-app link clicks in the capture phase.
    const onClick = (e: MouseEvent) => {
      if (!ref.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.dataset.noBlock !== undefined) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [message]);
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
export const asNumber = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const asArray = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
