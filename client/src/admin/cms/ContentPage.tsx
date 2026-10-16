import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Plus, Search, ShieldAlert, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton, Switch, useToast } from '@/components/ui';
import { ApiError, apiRequest, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { CharCount, ChipInput, FieldError, Hint, LabelRow } from './components/bits';
import { ImageField } from './components/MediaPicker';
import { asArray, asString, isoToLocalInput, localInputToIso, slugify } from './components/utils';

/* --------------------------------- Config --------------------------------- */

type Item = Record<string, unknown> & { _id: string };

type FieldSpec = { key: string; label: string; help?: ReactNode; full?: boolean; showIf?: (v: Item) => boolean } & (
  | { kind: 'text'; max: number; required?: boolean; mono?: boolean; upper?: boolean; list?: string[] }
  | { kind: 'textarea'; max: number; rows?: number; required?: boolean }
  | { kind: 'slug'; from: string }
  | { kind: 'number'; min: number; max: number; optional?: boolean }
  | { kind: 'select'; options: { value: string; label: string }[] }
  | { kind: 'image' }
  | { kind: 'tags'; max: number; lowercase?: boolean }
  | { kind: 'switch'; description?: string }
  | { kind: 'datetime' }
  | { kind: 'link' }
  | { kind: 'rating' }
);

interface CollectionConfig {
  key: string;
  label: string;
  singular: string;
  description: string;
  fields: FieldSpec[];
  defaults: Record<string, unknown>;
  row: (i: Item) => { title: string; subtitle?: string; image?: string; badges?: ReactNode };
  usedBy: string;
}

const MEMBER_CATEGORIES = ['transformation', 'before_after'];
const FACILITY_ICONS = ['dumbbell', 'heart-pulse', 'flame', 'waves', 'bike', 'shower-head', 'snowflake', 'sun', 'coffee', 'car', 'lock', 'sparkles', 'baby', 'users', 'trophy'];

const COLLECTIONS: CollectionConfig[] = [
  {
    key: 'programs',
    label: 'Programs',
    singular: 'program',
    description: 'Training programs shown in the Programs section and on /programs.',
    usedBy: 'Programs section · /programs',
    defaults: { title: '', slug: '', summary: '', description: '', imageUrl: '', level: 'all', tags: [], featured: false, published: true },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', max: 100, required: true },
      { key: 'slug', label: 'URL slug', kind: 'slug', from: 'title' },
      { key: 'summary', label: 'Summary', kind: 'textarea', max: 300, rows: 2, full: true },
      { key: 'description', label: 'Description', kind: 'textarea', max: 4000, rows: 6, full: true, help: 'Shown on the program detail page. Markdown supported.' },
      { key: 'imageUrl', label: 'Image', kind: 'image', full: true },
      { key: 'level', label: 'Level', kind: 'select', options: [{ value: 'all', label: 'All levels' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }] },
      { key: 'durationWeeks', label: 'Duration (weeks)', kind: 'number', min: 1, max: 104, optional: true },
      { key: 'sessionsPerWeek', label: 'Sessions per week', kind: 'number', min: 1, max: 14, optional: true },
      { key: 'tags', label: 'Tags', kind: 'tags', max: 10, full: true },
      { key: 'featured', label: 'Featured', kind: 'switch', description: 'Shown when a section is set to “featured only”.' },
    ],
    row: (i) => ({ title: asString(i.title), subtitle: `/${asString(i.slug)} · ${asString(i.level)}`, image: asString(i.imageUrl), badges: i.featured ? <Badge tone="primary">Featured</Badge> : null }),
  },
  {
    key: 'faqs',
    label: 'FAQs',
    singular: 'FAQ',
    description: 'Questions shown in FAQ sections (optionally filtered by category).',
    usedBy: 'FAQ section',
    defaults: { question: '', answer: '', category: 'general', published: true },
    fields: [
      { key: 'question', label: 'Question', kind: 'text', max: 300, required: true, full: true },
      { key: 'answer', label: 'Answer', kind: 'textarea', max: 3000, rows: 5, required: true, full: true },
      { key: 'category', label: 'Category', kind: 'text', max: 40, help: 'e.g. membership, classes, general', list: ['general', 'membership', 'classes', 'personal-training', 'payments', 'facility'] },
    ],
    row: (i) => ({ title: asString(i.question), subtitle: asString(i.category) }),
  },
  {
    key: 'facilities',
    label: 'Facilities',
    singular: 'facility',
    description: 'Amenities shown in the Facilities section.',
    usedBy: 'Facilities section',
    defaults: { name: '', description: '', imageUrl: '', icon: 'dumbbell', published: true },
    fields: [
      { key: 'name', label: 'Name', kind: 'text', max: 80, required: true },
      { key: 'icon', label: 'Icon', kind: 'text', max: 40, mono: true, list: FACILITY_ICONS, help: 'Lucide icon name, e.g. dumbbell, waves, flame' },
      { key: 'description', label: 'Description', kind: 'textarea', max: 600, rows: 3, full: true },
      { key: 'imageUrl', label: 'Image', kind: 'image', full: true },
    ],
    row: (i) => ({ title: asString(i.name), subtitle: asString(i.description).slice(0, 90), image: asString(i.imageUrl) }),
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    singular: 'testimonial',
    description: 'Curated quotes shown in the Testimonials section. Only publish quotes you have permission to use.',
    usedBy: 'Testimonials section',
    defaults: { name: '', subtitle: '', quote: '', rating: 5, avatarUrl: '', published: true },
    fields: [
      { key: 'name', label: 'Name', kind: 'text', max: 100, required: true },
      { key: 'subtitle', label: 'Subtitle', kind: 'text', max: 100, help: 'e.g. Member since 2022' },
      { key: 'quote', label: 'Quote', kind: 'textarea', max: 1000, rows: 4, required: true, full: true },
      { key: 'rating', label: 'Rating', kind: 'rating' },
      { key: 'avatarUrl', label: 'Photo', kind: 'image', full: true },
    ],
    row: (i) => ({ title: asString(i.name), subtitle: `“${asString(i.quote).slice(0, 80)}${asString(i.quote).length > 80 ? '…' : ''}”`, image: asString(i.avatarUrl), badges: <span className="inline-flex items-center gap-0.5 text-xs text-warning"><Star className="h-3 w-3 fill-current" />{asString(i.rating)}</span> }),
  },
  {
    key: 'gallery',
    label: 'Gallery & transformations',
    singular: 'gallery item',
    description: 'Facility photos, member transformations and before/after comparisons.',
    usedBy: 'Transformations, Before & after sections',
    defaults: { category: 'facility', title: '', story: '', memberDisplayName: '', imageUrl: '', beforeUrl: '', afterUrl: '', resultSummary: '', consent: { given: false, reference: '' }, published: false },
    fields: [
      { key: 'category', label: 'Category', kind: 'select', options: [{ value: 'facility', label: 'Facility' }, { value: 'general', label: 'General' }, { value: 'transformation', label: 'Member transformation' }, { value: 'before_after', label: 'Before & after' }] },
      { key: 'title', label: 'Title', kind: 'text', max: 120, required: true },
      { key: 'memberDisplayName', label: 'Member display name', kind: 'text', max: 100, help: 'As the member agreed to be named, e.g. “Priya S.”', showIf: (v) => MEMBER_CATEGORIES.includes(asString(v.category)) },
      { key: 'resultSummary', label: 'Result summary', kind: 'text', max: 120, help: 'e.g. −12 kg in 16 weeks', showIf: (v) => MEMBER_CATEGORIES.includes(asString(v.category)) },
      { key: 'durationWeeks', label: 'Duration (weeks)', kind: 'number', min: 0, max: 520, optional: true, showIf: (v) => MEMBER_CATEGORIES.includes(asString(v.category)) },
      { key: 'story', label: 'Story', kind: 'textarea', max: 3000, rows: 4, full: true },
      { key: 'imageUrl', label: 'Image', kind: 'image', full: true, showIf: (v) => v.category !== 'before_after' },
      { key: 'beforeUrl', label: 'Before image', kind: 'image', full: true, showIf: (v) => v.category === 'before_after' },
      { key: 'afterUrl', label: 'After image', kind: 'image', full: true, showIf: (v) => v.category === 'before_after' },
    ],
    row: (i) => ({ title: asString(i.title), subtitle: asString(i.category).replace('_', ' ') + (i.memberDisplayName ? ` · ${asString(i.memberDisplayName)}` : ''), image: asString(i.imageUrl) || asString(i.afterUrl) }),
  },
  {
    key: 'promotions',
    label: 'Promotions',
    singular: 'promotion',
    description: 'Time-limited offers shown as a site banner or popup while active.',
    usedBy: 'Site banner / popup',
    defaults: { title: '', body: '', ctaLabel: '', ctaHref: '', imageUrl: '', placement: 'banner', couponCode: '', startsAt: null, endsAt: null, published: true },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', max: 120, required: true, full: true },
      { key: 'body', label: 'Body', kind: 'textarea', max: 600, rows: 3, full: true },
      { key: 'placement', label: 'Placement', kind: 'select', options: [{ value: 'banner', label: 'Top banner' }, { value: 'popup', label: 'Popup' }] },
      { key: 'couponCode', label: 'Coupon code', kind: 'text', max: 30, mono: true, upper: true, help: 'Must match a coupon under Revenue → Coupons.' },
      { key: 'ctaLabel', label: 'Button label', kind: 'text', max: 40 },
      { key: 'ctaHref', label: 'Button link', kind: 'link' },
      { key: 'startsAt', label: 'Starts', kind: 'datetime' },
      { key: 'endsAt', label: 'Ends', kind: 'datetime' },
      { key: 'imageUrl', label: 'Image', kind: 'image', full: true },
    ],
    row: (i) => {
      const now = Date.now();
      const s = i.startsAt ? new Date(asString(i.startsAt)).getTime() : -Infinity;
      const e = i.endsAt ? new Date(asString(i.endsAt)).getTime() : Infinity;
      const state = now < s ? 'scheduled' : now > e ? 'ended' : 'running';
      return {
        title: asString(i.title),
        subtitle: `${asString(i.placement)}${i.couponCode ? ` · ${asString(i.couponCode)}` : ''}${i.endsAt ? ` · ends ${fmtDateTime(asString(i.endsAt))}` : ''}`,
        image: asString(i.imageUrl),
        badges: <Badge tone={state === 'running' ? 'success' : state === 'scheduled' ? 'info' : 'neutral'}>{state}</Badge>,
      };
    },
  },
];

/* ------------------------------ Payload helpers ----------------------------- */

const needsConsent = (i: Item | Record<string, unknown>) => MEMBER_CATEGORIES.includes(asString(i.category));
const consentGiven = (i: Item | Record<string, unknown>) => Boolean((i.consent as { given?: boolean } | undefined)?.given);

/** Builds a full PUT/POST body from an item (the API validates the full schema on update). */
function toPayload(cfg: CollectionConfig, v: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    const val = v[f.key];
    if (f.kind === 'number') {
      if (typeof val === 'number' && Number.isFinite(val)) out[f.key] = val;
    } else if (f.kind === 'datetime') out[f.key] = val ? val : null;
    else if (f.kind === 'tags') out[f.key] = asArray<string>(val);
    else if (f.kind === 'switch') out[f.key] = Boolean(val);
    else if (f.kind === 'rating') out[f.key] = Number(val) || 5;
    else if (val !== undefined && val !== null) out[f.key] = val;
  }
  out.published = Boolean(v.published);
  if (typeof v.order === 'number') out.order = v.order;
  if (cfg.key === 'gallery') {
    const c = (v.consent ?? {}) as { given?: boolean; reference?: string };
    out.consent = { given: Boolean(c.given), reference: asString(c.reference) };
  }
  return out;
}

/* ---------------------------------- Form ---------------------------------- */

function FieldInput({ f, value, setValue, all, errors }: { f: FieldSpec; value: unknown; setValue: (k: string, v: unknown) => void; all: Record<string, unknown>; errors: Record<string, string> }) {
  const id = `cf-${f.key}`;
  const err = errors[f.key];
  switch (f.kind) {
    case 'text': {
      const v = asString(value);
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} required={f.required} right={<CharCount value={v} max={f.max} />} />
          <input id={id} className={cn('input', f.mono && 'font-mono text-[0.85rem]')} list={f.list ? `${id}-list` : undefined} value={v} onChange={(e) => setValue(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)} aria-invalid={err ? true : undefined} />
          {f.list && (
            <datalist id={`${id}-list`}>
              {f.list.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
          <FieldError>{err}</FieldError>
          <Hint>{!err && f.help}</Hint>
        </div>
      );
    }
    case 'textarea': {
      const v = asString(value);
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} required={f.required} right={<CharCount value={v} max={f.max} />} />
          <textarea id={id} rows={f.rows ?? 4} className="input resize-y" value={v} onChange={(e) => setValue(f.key, e.target.value)} aria-invalid={err ? true : undefined} />
          <FieldError>{err}</FieldError>
          <Hint>{!err && f.help}</Hint>
        </div>
      );
    }
    case 'slug': {
      const v = asString(value);
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} required right={<button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setValue(f.key, slugify(asString(all[f.from])))}>Generate from title</button>} />
          <input id={id} className="input font-mono text-[0.85rem]" value={v} onChange={(e) => setValue(f.key, e.target.value.toLowerCase().replace(/\s+/g, '-'))} aria-invalid={err ? true : undefined} />
          <FieldError>{err}</FieldError>
          <Hint>{!err && 'Lowercase letters, numbers and hyphens. Changing it changes the public URL.'}</Hint>
        </div>
      );
    }
    case 'number':
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} right={<span className="text-[0.7rem] text-muted">{f.min}–{f.max}</span>} />
          <input id={id} type="number" className="input" min={f.min} max={f.max} value={typeof value === 'number' ? value : ''} onChange={(e) => setValue(f.key, e.target.value === '' ? undefined : Number(e.target.value))} aria-invalid={err ? true : undefined} />
          <FieldError>{err}</FieldError>
          <Hint>{!err && f.help}</Hint>
        </div>
      );
    case 'select':
      return <Select id={id} label={f.label} value={asString(value, f.options[0]?.value)} options={f.options} onChange={(e) => setValue(f.key, e.target.value)} error={err} hint={f.help} />;
    case 'image':
      return <ImageField label={f.label} value={asString(value)} onChange={(v) => setValue(f.key, v)} error={err} hint={f.help} />;
    case 'tags':
      return <ChipInput label={f.label} value={asArray<string>(value)} onChange={(v) => setValue(f.key, v)} max={f.max} lowercase={f.lowercase} error={err} hint={f.help} />;
    case 'switch':
      return <Switch label={f.label} description={f.description} checked={Boolean(value)} onChange={(v) => setValue(f.key, v)} />;
    case 'datetime':
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} right={value ? <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setValue(f.key, null)}>Clear</button> : undefined} />
          <input id={id} type="datetime-local" className="input" value={isoToLocalInput(asString(value))} onChange={(e) => setValue(f.key, localInputToIso(e.target.value) || null)} aria-invalid={err ? true : undefined} />
          <FieldError>{err}</FieldError>
          <Hint>{!err && 'Local time. Leave empty for no limit.'}</Hint>
        </div>
      );
    case 'link': {
      const v = asString(value);
      return (
        <div>
          <LabelRow htmlFor={id} label={f.label} />
          <input id={id} className="input" value={v} placeholder="/memberships" onChange={(e) => setValue(f.key, e.target.value)} aria-invalid={err ? true : undefined} />
          <FieldError>{err}</FieldError>
          <Hint>{!err && 'A /path, #anchor or https:// URL.'}</Hint>
        </div>
      );
    }
    case 'rating': {
      const n = Number(value) || 5;
      return (
        <fieldset>
          <legend className="label">{f.label}</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" role="radio" aria-checked={n === r} aria-label={`${r} star${r > 1 ? 's' : ''}`} onClick={() => setValue(f.key, r)} className="rounded p-1 text-warning transition hover:scale-110">
                <Star className={cn('h-6 w-6', r <= n ? 'fill-current' : 'opacity-30')} />
              </button>
            ))}
          </div>
        </fieldset>
      );
    }
  }
}

function EditModal({ cfg, item, onClose }: { cfg: CollectionConfig; item: Item | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const isNew = item === 'new';
  useEffect(() => {
    if (!item) return;
    setV(item === 'new' ? { ...cfg.defaults } : { ...item });
    setErrors({});
    setSlugTouched(item !== 'new');
  }, [item, cfg]);

  const setValue = (k: string, val: unknown) => {
    setV((cur) => {
      const next = { ...cur, [k]: val };
      const slugField = cfg.fields.find((f) => f.kind === 'slug') as Extract<FieldSpec, { kind: 'slug' }> | undefined;
      if (slugField && k === slugField.from && !slugTouched) next[slugField.key] = slugify(asString(val));
      if (slugField && k === slugField.key) setSlugTouched(true);
      return next;
    });
    setErrors((e) => {
      if (!e[k]) return e;
      const { [k]: _d, ...rest } = e;
      return rest;
    });
  };

  const m = useMutation({
    mutationFn: () => {
      const body = toPayload(cfg, v);
      return isNew ? api.post<Item>(`/cms/admin/${cfg.key}`, body) : api.put<Item>(`/cms/admin/${cfg.key}/${(item as Item)._id}`, body);
    },
    onSuccess: () => {
      toast.success(isNew ? `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} created` : 'Changes saved', v.published ? 'Live on the website now.' : 'Saved as unpublished.');
      void qc.invalidateQueries({ queryKey: ['cms-content', cfg.key] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (/duplicate|exists|E11000/i.test(err.message) && cfg.fields.some((f) => f.kind === 'slug')) fe.slug = 'This slug is already used';
        setErrors(fe);
      }
      toast.error(err);
    },
  });

  const consent = (v.consent ?? { given: false, reference: '' }) as { given: boolean; reference: string };
  const memberItem = cfg.key === 'gallery' && needsConsent(v);
  const publishBlocked = memberItem && !consent.given;
  useEffect(() => {
    if (publishBlocked && v.published) setV((cur) => ({ ...cur, published: false }));
  }, [publishBlocked, v.published]);

  const visible = cfg.fields.filter((f) => !f.showIf || f.showIf(v as Item));

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      size="lg"
      title={isNew ? `New ${cfg.singular}` : `Edit ${cfg.singular}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>
            {isNew ? 'Create' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-5"
      >
        {Object.keys(errors).length > 0 && (
          <Alert tone="danger" title="Please fix the highlighted fields">
            {Object.entries(errors)
              .filter(([k]) => !visible.some((f) => f.key === k))
              .map(([k, msg]) => (
                <p key={k}>
                  {k}: {msg}
                </p>
              ))}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((f) => (
            <div key={f.key} className={cn(f.full && 'sm:col-span-2')}>
              <FieldInput f={f} value={v[f.key]} setValue={setValue} all={v} errors={errors} />
            </div>
          ))}
        </div>

        {memberItem && (
          <fieldset className={cn('space-y-3 rounded-theme-sm border p-4', consent.given ? 'border-success/40 bg-success/[0.05]' : 'border-warning/40 bg-warning/[0.06]')}>
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
              {consent.given ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-warning" />} Member consent
            </legend>
            <p className="text-xs text-fg/75">
              Member photos and stories are personal data. Only publish them with the member’s <strong>written</strong> consent (e.g. a signed release form or an email confirming they agree to these specific images and wording being shown publicly). Members can withdraw consent at any time — unpublish immediately if they do. The website never shows member items without consent, even if marked published.
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-primary))]" checked={consent.given} onChange={(e) => setValue('consent', { ...consent, given: e.target.checked })} />
              <span>Member’s written consent recorded</span>
            </label>
            <div>
              <LabelRow htmlFor="consent-ref" label="Consent reference" right={<CharCount value={consent.reference} max={200} />} />
              <input id="consent-ref" className="input" maxLength={200} value={consent.reference} onChange={(e) => setValue('consent', { ...consent, reference: e.target.value })} placeholder="e.g. Release form #2024-118, signed 12 Mar 2026" />
              <FieldError>{errors['consent.given'] ?? errors['consent.reference']}</FieldError>
              {consent.given && (v.consent as { recordedAt?: string } | undefined)?.recordedAt && <Hint>Recorded {fmtDateTime((v.consent as { recordedAt: string }).recordedAt)}</Hint>}
            </div>
          </fieldset>
        )}

        <div className="grid gap-4 border-t border-line/70 pt-4 sm:grid-cols-2">
          <div>
            <Switch label="Published" description={publishBlocked ? 'Record member consent first.' : 'Visible on the website.'} checked={Boolean(v.published)} disabled={publishBlocked} onChange={(val) => setValue('published', val)} />
          </div>
          <div>
            <LabelRow htmlFor="cf-order" label="Sort order" right={<span className="text-[0.7rem] text-muted">lower first</span>} />
            <input id="cf-order" type="number" min={0} max={1000} className="input" value={typeof v.order === 'number' ? v.order : 50} onChange={(e) => setValue('order', Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function ContentPage() {
  const { collection = 'programs' } = useParams();
  const cfg = COLLECTIONS.find((c) => c.key === collection);
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setQ('');
    setDebouncedQ('');
  }, [collection]);

  const list = useQuery({
    queryKey: ['cms-content', collection, debouncedQ],
    enabled: Boolean(cfg),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiRequest<Item[]>(`/cms/admin/${collection}`, { query: { q: debouncedQ || undefined, limit: 100 } });
      return { items: res.data, total: res.meta?.total ?? res.data.length };
    },
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const del = useMutation({
    mutationFn: (i: Item) => api.delete(`/cms/admin/${collection}/${i._id}`),
    onSuccess: () => {
      toast.success('Deleted');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['cms-content', collection] });
    },
    onError: (e) => toast.error(e),
  });

  if (!cfg) return <Navigate to="/admin/website/content/programs" replace />;

  const put = (i: Item, patch: Record<string, unknown>) => api.put(`/cms/admin/${cfg.key}/${i._id}`, toPayload(cfg, { ...i, ...patch }));

  const togglePublished = async (i: Item) => {
    setBusyId(i._id);
    try {
      await put(i, { published: !i.published });
      toast.success(i.published ? 'Unpublished' : 'Published');
      await qc.invalidateQueries({ queryKey: ['cms-content', cfg.key] });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  };

  /** Re-numbers the list (0, 10, 20…) after a move and saves only the items whose order changed. */
  const moveItem = async (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setBusyId(x._id);
    try {
      const changed = next.map((it, idx) => ({ it, order: idx * 10 })).filter(({ it, order }) => it.order !== order);
      await Promise.all(changed.map(({ it, order }) => put(it, { order })));
      await qc.invalidateQueries({ queryKey: ['cms-content', cfg.key] });
    } catch (err) {
      toast.error(err);
      void qc.invalidateQueries({ queryKey: ['cms-content', cfg.key] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Website · Content"
        title={cfg.label}
        description={cfg.description}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New {cfg.singular}
          </Button>
        }
      />
      <nav aria-label="Content collections" className="scrollbar-thin mb-5 flex gap-1 overflow-x-auto rounded-full border border-line bg-fg/[0.03] p-1">
        {COLLECTIONS.map((c) => (
          <NavLink key={c.key} to={`/admin/website/content/${c.key}`} className={({ isActive }) => cn('whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition', isActive ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg')}>
            {c.label}
          </NavLink>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cfg.label.toLowerCase()}`} aria-label={`Search ${cfg.label}`} />
        </div>
        <span className="text-xs text-muted">Used by: {cfg.usedBy}</span>
        {list.data && <span className="ml-auto text-xs text-muted">{list.data.total} items</span>}
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={debouncedQ ? 'Nothing matches your search' : `No ${cfg.label.toLowerCase()} yet`} description={debouncedQ ? undefined : cfg.description} action={!debouncedQ && <Button onClick={() => setEditing('new')}>New {cfg.singular}</Button>} />
      ) : (
        <ul className="space-y-2" aria-label={cfg.label}>
          {items.map((it, idx) => {
            const r = cfg.row(it);
            const blocked = cfg.key === 'gallery' && needsConsent(it) && !consentGiven(it);
            return (
              <li key={it._id} className={cn('card flex items-center gap-3 p-3 transition', busyId === it._id && 'opacity-60')}>
                <div className="flex flex-col">
                  <button type="button" className="grid h-6 w-7 place-items-center rounded text-muted hover:bg-fg/[0.07] hover:text-fg disabled:opacity-30" disabled={idx === 0 || Boolean(busyId) || Boolean(debouncedQ)} onClick={() => void moveItem(idx, idx - 1)} aria-label={`Move ${r.title} up`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="grid h-6 w-7 place-items-center rounded text-muted hover:bg-fg/[0.07] hover:text-fg disabled:opacity-30" disabled={idx === items.length - 1 || Boolean(busyId) || Boolean(debouncedQ)} onClick={() => void moveItem(idx, idx + 1)} aria-label={`Move ${r.title} down`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                {r.image !== undefined && <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-fg/[0.06]">{r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-4 w-4 text-muted" />}</span>}
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(it)}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{r.title || 'Untitled'}</span>
                    {r.badges}
                    {cfg.key === 'gallery' && needsConsent(it) && (consentGiven(it) ? <Badge tone="success">Consent recorded</Badge> : <Badge tone="warning">No consent</Badge>)}
                  </span>
                  {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                </button>
                <div className="hidden w-32 sm:block" title={blocked ? 'Record member consent before publishing' : undefined}>
                  <Switch label={<span className="text-xs text-muted">{it.published ? 'Published' : 'Hidden'}</span>} checked={Boolean(it.published)} disabled={busyId === it._id || (blocked && !it.published)} onChange={() => void togglePublished(it)} />
                </div>
                <Button size="sm" variant="ghost" aria-label={`Edit ${r.title}`} onClick={() => setEditing(it)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" aria-label={`Delete ${r.title}`} onClick={() => setDeleting(it)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {debouncedQ && items.length > 1 && <p className="mt-3 text-xs text-muted">Clear the search to reorder items.</p>}

      <EditModal cfg={cfg} item={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        tone="danger"
        loading={del.isPending}
        title={`Delete this ${cfg.singular}?`}
        description="It is removed from the website immediately. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && del.mutate(deleting)}
      />
    </div>
  );
}
