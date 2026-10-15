import { useId, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { Seo } from '@apex/shared';
import { Switch } from '@/components/ui';
import { CharCount, FieldError, Hint, LabelRow } from './bits';
import { ImageField } from './MediaPicker';
import { pageSlugError, SHADOWED_SLUGS } from './utils';

export interface PageSettingsValue {
  title: string;
  slug: string;
  seo: Seo;
  featuredImage: string;
  showInNav: boolean;
  navOrder: number;
}

function Text({ label, value, onChange, max, error, hint, disabled, prefix, multiline, required }: { label: string; value: string; onChange: (v: string) => void; max?: number; error?: string; hint?: ReactNode; disabled?: boolean; prefix?: string; multiline?: boolean; required?: boolean }) {
  const id = useId();
  return (
    <div>
      <LabelRow htmlFor={id} label={label} required={required} right={max ? <CharCount value={value} max={max} /> : undefined} />
      <div className="flex">
        {prefix && <span className="inline-flex items-center rounded-l-theme-sm border border-r-0 border-line bg-fg/[0.04] px-3 text-sm text-muted">{prefix}</span>}
        {multiline ? (
          <textarea id={id} rows={3} className="input resize-y" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} disabled={disabled} />
        ) : (
          <input id={id} className={prefix ? 'input rounded-l-none' : 'input'} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} disabled={disabled} />
        )}
      </div>
      <FieldError>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
    </div>
  );
}

/** Page-level settings: title, slug, SEO, featured image, navigation. */
export function PageSettingsPanel({ value, onChange, system, isHome, errors, originalSlug }: { value: PageSettingsValue; onChange: (v: PageSettingsValue) => void; system: boolean; isHome: boolean; errors: Record<string, string>; originalSlug: string }) {
  const set = <K extends keyof PageSettingsValue>(k: K, v: PageSettingsValue[K]) => onChange({ ...value, [k]: v });
  const setSeo = <K extends keyof Seo>(k: K, v: Seo[K]) => onChange({ ...value, seo: { ...value.seo, [k]: v } });
  const slugErr = errors.slug ?? (value.slug !== originalSlug ? pageSlugError(value.slug) : undefined);
  const navId = useId();
  const seoTitle = value.seo.title || value.title;
  const seoDesc = value.seo.description;
  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">Page</h3>
        <Text label="Title" value={value.title} onChange={(v) => set('title', v)} max={120} error={errors.title ?? (!value.title.trim() ? 'Title is required' : undefined)} required />
        <Text
          label="URL slug"
          prefix="/"
          value={isHome ? '' : value.slug}
          onChange={(v) => set('slug', v.toLowerCase().replace(/\s+/g, '-'))}
          disabled={system || isHome}
          error={slugErr}
          hint={
            system || isHome
              ? 'System page — the URL cannot be changed.'
              : SHADOWED_SLUGS.includes(value.slug)
                ? 'Warning: this URL is used by a built-in page, so this CMS page would not be reachable.'
                : 'Lowercase letters, numbers and hyphens. Changing it changes the live URL as soon as the draft is saved.'
          }
        />
        <ImageField label="Featured image" value={value.featuredImage} onChange={(v) => set('featuredImage', v)} error={errors.featuredImage} hint="Used in page cards and as the social image fallback." />
      </section>

      <section className="space-y-4 border-t border-line/70 pt-6">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">Navigation</h3>
        <Switch label="Show in main navigation" description={isHome ? 'The home page is always linked by the logo.' : 'Listed in the header menu while the page is published.'} checked={value.showInNav} onChange={(v) => set('showInNav', v)} disabled={isHome} />
        <div>
          <LabelRow htmlFor={navId} label="Navigation order" right={<span className="text-[0.7rem] text-muted">0–100, lower first</span>} />
          <input id={navId} type="number" min={0} max={100} className="input" value={value.navOrder} onChange={(e) => set('navOrder', Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
          <FieldError>{errors.navOrder}</FieldError>
        </div>
        <p className="flex gap-2 text-xs text-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Navigation visibility, order and the URL slug are page properties: they take effect on the live site as soon as the draft is saved (not on publish).
        </p>
      </section>

      <section className="space-y-4 border-t border-line/70 pt-6">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">Search & social</h3>
        <Text label="SEO title" value={value.seo.title} onChange={(v) => setSeo('title', v)} max={70} error={errors['seo.title']} hint="Defaults to the page title. Aim for 50–60 characters." />
        <Text label="Meta description" multiline value={value.seo.description} onChange={(v) => setSeo('description', v)} max={170} error={errors['seo.description']} hint="Aim for 120–160 characters." />
        <ImageField label="Social share image" value={value.seo.image} onChange={(v) => setSeo('image', v)} error={errors['seo.image']} hint="1200×630 recommended." />
        <Switch label="Hide from search engines" description="Adds noindex to this page." checked={value.seo.noIndex} onChange={(v) => setSeo('noIndex', v)} />
        <div className="rounded-theme-sm border border-line bg-bg/40 p-3.5" aria-label="Search result preview">
          <p className="mb-1 text-[0.65rem] uppercase tracking-wider text-muted">Search preview</p>
          <p className="truncate text-[0.95rem] text-sky-300">{seoTitle || 'Untitled page'}</p>
          <p className="truncate text-xs text-success/80">{window.location.host}/{isHome ? '' : value.slug}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-fg/70">{seoDesc || 'Add a meta description to control the snippet shown in search results.'}</p>
        </div>
      </section>
    </div>
  );
}
