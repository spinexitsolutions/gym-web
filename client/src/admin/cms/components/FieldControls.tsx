import { useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { SECTION_META, type Cta, type FieldDef, type SectionType } from '@apex/shared';
import { Button, Select, Switch } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CharCount, FieldError, Hint, IconButton, LabelRow, RangeField } from './bits';
import { ImageField, MediaPicker } from './MediaPicker';
import { SceneEditor, useModelOptions } from './SceneEditor';
import { asArray, asNumber, asString, isoToLocalInput, isRecord, localInputToIso } from './utils';
import { isRequired, maxOf, propSchema } from './zodIntrospect';

export type ErrorMap = Record<string, string>;

/** Errors under `prefix.` with the prefix stripped. */
export function subErrors(errors: ErrorMap, prefix: string): ErrorMap {
  const out: ErrorMap = {};
  for (const [k, v] of Object.entries(errors)) if (k.startsWith(`${prefix}.`)) out[k.slice(prefix.length + 1)] = v;
  return out;
}
/** First error at `key` or below it. */
export const anyError = (errors: ErrorMap, key: string) => errors[key] ?? Object.entries(errors).find(([k]) => k.startsWith(`${key}.`))?.[1];

const LINK_HINT = 'Use /page for site pages, #anchor for a section on this page, or a full https:// URL.';

/* ------------------------------ Generic list UI ----------------------------- */

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

function ListItemShell({ index, count, title, onMove, onRemove, children, error, removeDisabled }: { index: number; count: number; title: ReactNode; onMove: (to: number) => void; onRemove: () => void; children: ReactNode; error?: boolean; removeDisabled?: boolean }) {
  return (
    <li className={cn('rounded-theme-sm border bg-bg/40 p-3', error ? 'border-danger/60' : 'border-line')}>
      <div className="mb-2.5 flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-muted">{title}</span>
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Remove" tone="danger" disabled={removeDisabled} onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className="space-y-3">{children}</div>
    </li>
  );
}

function ListHeader({ label, count, max, min }: { label: ReactNode; count: number; max?: number; min?: number }) {
  return (
    <div className="mb-2 flex items-end justify-between">
      <span className="label !mb-0">{label}</span>
      <span className="text-[0.7rem] text-muted">
        {count}
        {max !== undefined && ` / ${max}`}
        {min ? ` · min ${min}` : ''}
      </span>
    </div>
  );
}

/* ------------------------------- Small inputs ------------------------------- */

function TextControl({ label, value, onChange, error, hint, max, multiline, rows, required, placeholder, mono }: { label: ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; max?: number; multiline?: boolean; rows?: number; required?: boolean; placeholder?: string; mono?: boolean }) {
  const id = useId();
  const common = {
    id,
    value,
    placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-err` : undefined,
    className: cn('input', multiline && 'resize-y', mono && 'font-mono text-[0.8rem]'),
  } as const;
  return (
    <div>
      <LabelRow htmlFor={id} label={label} required={required} right={max ? <CharCount value={value} max={max} /> : undefined} />
      {multiline ? <textarea {...common} rows={rows ?? 4} onChange={(e) => onChange(e.target.value)} /> : <input {...common} onChange={(e) => onChange(e.target.value)} />}
      <FieldError id={`${id}-err`}>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
    </div>
  );
}

function NumberControl({ label, value, onChange, min, max, error, hint }: { label: ReactNode; value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div>
      <LabelRow htmlFor={id} label={label} right={min !== undefined && max !== undefined ? <span className="text-[0.7rem] text-muted">{min}–{max}</span> : undefined} />
      <input id={id} type="number" inputMode="numeric" className="input" min={min} max={max} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} aria-invalid={error ? true : undefined} />
      <FieldError>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
    </div>
  );
}

/* --------------------------------- CTAs ------------------------------------ */

const CTA_VARIANTS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'ghost', label: 'Ghost / text' },
];

function CtaFields({ value, onChange, errors }: { value: Partial<Cta>; onChange: (v: Cta) => void; errors: ErrorMap }) {
  const v: Cta = { label: asString(value.label), href: asString(value.href), variant: (value.variant as Cta['variant']) ?? 'primary' };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextControl label="Label" value={v.label} max={40} required onChange={(label) => onChange({ ...v, label })} error={errors.label} />
      <Select label="Style" value={v.variant} options={CTA_VARIANTS} onChange={(e) => onChange({ ...v, variant: e.target.value as Cta['variant'] })} />
      <div className="sm:col-span-2">
        <TextControl label="Link" value={v.href} onChange={(href) => onChange({ ...v, href })} error={errors.href} hint={LINK_HINT} placeholder="/memberships" />
      </div>
    </div>
  );
}

function CtasEditor({ label, value, onChange, errors, max = 3 }: { label: string; value: unknown; onChange: (v: Cta[]) => void; errors: ErrorMap; max?: number }) {
  const items = asArray<Cta>(value);
  return (
    <div>
      <ListHeader label={label} count={items.length} max={max} />
      {items.length > 0 && (
        <ol className="space-y-2.5">
          {items.map((c, i) => (
            <ListItemShell key={i} index={i} count={items.length} title={c.label || `Button ${i + 1}`} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} error={Boolean(anyError(errors, String(i)))}>
              <CtaFields value={c} errors={subErrors(errors, String(i))} onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))} />
            </ListItemShell>
          ))}
        </ol>
      )}
      <Button size="sm" variant="secondary" className="mt-2.5" disabled={items.length >= max} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...items, { label: 'Learn more', href: '/', variant: items.length ? 'secondary' : 'primary' }])}>
        Add button
      </Button>
      {errors[''] && <FieldError>{errors['']}</FieldError>}
    </div>
  );
}

function CtaEditor({ label, value, onChange, errors }: { label: string; value: unknown; onChange: (v: Cta | undefined) => void; errors: ErrorMap }) {
  if (!isRecord(value))
    return (
      <div>
        <span className="label">{label}</span>
        <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange({ label: 'Learn more', href: '/', variant: 'primary' })}>
          Add button
        </Button>
        <Hint>Optional.</Hint>
      </div>
    );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label !mb-0">{label}</span>
        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger" onClick={() => onChange(undefined)}>
          <X className="h-3.5 w-3.5" /> Remove button
        </button>
      </div>
      <div className="rounded-theme-sm border border-line bg-bg/40 p-3">
        <CtaFields value={value as Partial<Cta>} onChange={onChange} errors={errors} />
      </div>
    </div>
  );
}

/* ------------------------------- String list ------------------------------- */

function StringListEditor({ label, value, onChange, errors, max = 8 }: { label: string; value: unknown; onChange: (v: string[]) => void; errors: ErrorMap; max?: number }) {
  const items = asArray<string>(value);
  return (
    <div>
      <ListHeader label={label} count={items.length} max={max} />
      <ol className="space-y-2">
        {items.map((s, i) => (
          <li key={i}>
            <div className="flex items-center gap-1">
              <input className="input" value={s} aria-label={`${label} ${i + 1}`} maxLength={120} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={errors[String(i)] ? true : undefined} />
              <IconButton label="Move up" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
                <ArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))}>
                <ArrowDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Remove" tone="danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
            <FieldError>{errors[String(i)]}</FieldError>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="mt-2.5" disabled={items.length >= max} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...items, ''])}>
        Add item
      </Button>
    </div>
  );
}

/* -------------------------------- Stat items ------------------------------- */

const METRICS = [
  { value: 'manual', label: 'Manual value' },
  { value: 'activeMembers', label: 'Live: active members' },
  { value: 'trainers', label: 'Live: trainers on website' },
  { value: 'programs', label: 'Live: published programs' },
  { value: 'classesThisWeek', label: 'Live: classes this week' },
];
interface StatItem {
  label: string;
  value: number;
  suffix: string;
  metric: string;
}

function StatItemsEditor({ label, value, onChange, errors }: { label: string; value: unknown; onChange: (v: StatItem[]) => void; errors: ErrorMap }) {
  const items = asArray<Partial<StatItem>>(value).map((x) => ({ label: asString(x.label), value: asNumber(x.value, 0), suffix: asString(x.suffix), metric: asString(x.metric, 'manual') || 'manual' }));
  const update = (i: number, patch: Partial<StatItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <ListHeader label={label} count={items.length} max={6} min={1} />
      <ol className="space-y-2.5">
        {items.map((s, i) => {
          const e = subErrors(errors, String(i));
          return (
            <ListItemShell key={i} index={i} count={items.length} title={s.label || `Stat ${i + 1}`} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} error={Object.keys(e).length > 0}>
              <TextControl label="Label" value={s.label} max={40} required onChange={(v) => update(i, { label: v })} error={e.label} />
              <Select label="Source" value={s.metric} options={METRICS} onChange={(ev) => update(i, { metric: ev.target.value })} hint={s.metric !== 'manual' ? 'Calculated from the database when the page loads.' : undefined} />
              <div className="grid grid-cols-2 gap-3">
                <NumberControl label={s.metric === 'manual' ? 'Value' : 'Fallback value'} value={s.value} min={0} max={10000000} onChange={(v) => update(i, { value: v ?? 0 })} error={e.value} />
                <TextControl label="Suffix" value={s.suffix} max={6} placeholder="+, %, k" onChange={(v) => update(i, { suffix: v })} error={e.suffix} />
              </div>
            </ListItemShell>
          );
        })}
      </ol>
      <Button size="sm" variant="secondary" className="mt-2.5" disabled={items.length >= 6} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...items, { label: 'New stat', value: 0, suffix: '', metric: 'manual' }])}>
        Add statistic
      </Button>
      {errors[''] && <FieldError>{errors['']}</FieldError>}
    </div>
  );
}

/* ----------------------------- Equipment items ----------------------------- */

interface EquipmentItem {
  title: string;
  description: string;
  modelId: string;
}
function EquipmentRow({ item, onChange, errors }: { item: EquipmentItem; onChange: (v: EquipmentItem) => void; errors: ErrorMap }) {
  const options = useModelOptions(item.modelId);
  return (
    <>
      <TextControl label="Title" value={item.title} max={60} required onChange={(v) => onChange({ ...item, title: v })} error={errors.title} />
      <TextControl label="Description" value={item.description} max={240} multiline rows={2} onChange={(v) => onChange({ ...item, description: v })} error={errors.description} />
      <Select label="3D model" value={item.modelId} options={options} onChange={(e) => onChange({ ...item, modelId: e.target.value })} error={errors.modelId} />
    </>
  );
}
function EquipmentItemsEditor({ label, value, onChange, errors }: { label: string; value: unknown; onChange: (v: EquipmentItem[]) => void; errors: ErrorMap }) {
  const items = asArray<Partial<EquipmentItem>>(value).map((x) => ({ title: asString(x.title), description: asString(x.description), modelId: asString(x.modelId, 'dumbbell') || 'dumbbell' }));
  return (
    <div>
      <ListHeader label={label} count={items.length} max={6} min={1} />
      <ol className="space-y-2.5">
        {items.map((it, i) => {
          const e = subErrors(errors, String(i));
          return (
            <ListItemShell key={i} index={i} count={items.length} title={it.title || `Item ${i + 1}`} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} error={Object.keys(e).length > 0}>
              <EquipmentRow item={it} errors={e} onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))} />
            </ListItemShell>
          );
        })}
      </ol>
      <Button size="sm" variant="secondary" className="mt-2.5" disabled={items.length >= 6} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...items, { title: 'New equipment', description: '', modelId: 'dumbbell' }])}>
        Add equipment
      </Button>
      {errors[''] && <FieldError>{errors['']}</FieldError>}
    </div>
  );
}

/* ----------------------------- Gallery images ------------------------------ */

interface GalleryImage {
  url: string;
  alt: string;
}
function GalleryImagesEditor({ label, value, onChange, errors, max = 24 }: { label: string; value: unknown; onChange: (v: GalleryImage[]) => void; errors: ErrorMap; max?: number }) {
  const [open, setOpen] = useState(false);
  const items = asArray<Partial<GalleryImage>>(value).map((x) => ({ url: asString(x.url), alt: asString(x.alt) }));
  return (
    <div>
      <ListHeader label={label} count={items.length} max={max} />
      {items.length > 0 ? (
        <ol className="grid grid-cols-2 gap-2.5">
          {items.map((img, i) => {
            const e = subErrors(errors, String(i));
            return (
              <li key={`${img.url}-${i}`} className={cn('overflow-hidden rounded-theme-sm border bg-bg/40', Object.keys(e).length ? 'border-danger/60' : 'border-line')}>
                <div className="relative aspect-[4/3] bg-fg/5">
                  {img.url && <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute right-1 top-1 flex gap-0.5 rounded-lg bg-black/60 backdrop-blur">
                    <IconButton label="Move earlier" className="h-7 w-7 text-white/80" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
                      <ArrowUp className="h-3.5 w-3.5 -rotate-90" />
                    </IconButton>
                    <IconButton label="Move later" className="h-7 w-7 text-white/80" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))}>
                      <ArrowDown className="h-3.5 w-3.5 -rotate-90" />
                    </IconButton>
                    <IconButton label="Remove image" tone="danger" className="h-7 w-7 text-white/80" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>
                <div className="p-2">
                  <input className="input !py-1.5 text-xs" placeholder="Alt text (describe the image)" aria-label={`Alt text for image ${i + 1}`} maxLength={160} value={img.alt} onChange={(ev) => onChange(items.map((x, j) => (j === i ? { ...x, alt: ev.target.value } : x)))} />
                  <FieldError>{e.url ?? e.alt}</FieldError>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-theme-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No images yet.</p>
      )}
      <Button size="sm" variant="secondary" className="mt-2.5" disabled={items.length >= max} icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        Add images
      </Button>
      <MediaPicker open={open} multiple onClose={() => setOpen(false)} onSelect={(imgs) => onChange([...items, ...imgs.map((x) => ({ url: x.url, alt: x.alt }))].slice(0, max))} />
    </div>
  );
}

/* -------------------------------- Background ------------------------------- */

const BG_VARIANTS = [
  { value: 'default', label: 'Default (page background)' },
  { value: 'surface', label: 'Surface (raised panel)' },
  { value: 'gradient', label: 'Brand gradient' },
  { value: 'image', label: 'Image with overlay' },
  { value: 'contrast', label: 'High contrast (inverted)' },
];
function BackgroundEditor({ label, value, onChange, errors }: { label: string; value: unknown; onChange: (v: { variant: string; imageUrl: string; overlay: number }) => void; errors: ErrorMap }) {
  const v = isRecord(value) ? value : {};
  const bg = { variant: asString(v.variant, 'default') || 'default', imageUrl: asString(v.imageUrl), overlay: asNumber(v.overlay, 0.6) };
  return (
    <fieldset className="space-y-3 rounded-theme-sm border border-line bg-bg/30 p-3">
      <legend className="label px-1">{label}</legend>
      <Select label="Style" value={bg.variant} options={BG_VARIANTS} onChange={(e) => onChange({ ...bg, variant: e.target.value })} error={errors.variant} />
      {bg.variant === 'image' && (
        <>
          <ImageField label="Background image" value={bg.imageUrl} onChange={(url) => onChange({ ...bg, imageUrl: url })} error={errors.imageUrl} />
          <RangeField label="Overlay darkness" min={0} max={1} step={0.05} value={bg.overlay} onChange={(o) => onChange({ ...bg, overlay: o })} format={(x) => `${Math.round(x * 100)}%`} hint="Higher values keep text readable over busy photos." error={errors.overlay} />
        </>
      )}
    </fieldset>
  );
}

/* ------------------------------ Field dispatcher ---------------------------- */

interface FieldControlProps {
  sectionType: SectionType;
  field: FieldDef;
  props: Record<string, unknown>;
  setProp: (key: string, value: unknown) => void;
  errors: ErrorMap;
}

/** Renders the right control for a FieldDef and wires value, change and validation messages. */
export function FieldControl({ sectionType, field, props, setProp, errors }: FieldControlProps) {
  const schema = propSchema(sectionType, field.key);
  const value = props[field.key];
  const own = errors[field.key];
  const nested = subErrors(errors, field.key);
  const set = (v: unknown) => setProp(field.key, v);
  const max = maxOf(schema);
  const required = isRequired(schema);

  switch (field.type) {
    case 'text':
      return <TextControl label={field.label} value={asString(value)} onChange={set} error={own} hint={field.help} max={max} required={required} mono={field.key === 'anchorId' || field.key === 'highlightPlanSlug'} />;
    case 'textarea': {
      const md = /markdown/i.test(field.label) || sectionType === 'richText';
      return <TextControl label={field.label} value={asString(value)} onChange={set} error={own} hint={field.help ?? (md ? 'Markdown: **bold**, _italic_, - lists, [link](/path). Raw HTML is not rendered.' : undefined)} max={max} multiline rows={md ? 10 : field.key === 'body' ? 6 : 3} required={required} />;
    }
    case 'number':
      return <NumberControl label={field.label} value={typeof value === 'number' ? value : undefined} onChange={set} min={field.min} max={field.max} error={own} hint={field.help} />;
    case 'boolean':
      return (
        <div>
          <Switch label={field.label} description={field.help} checked={Boolean(value)} onChange={set} />
          <FieldError>{own}</FieldError>
        </div>
      );
    case 'select':
      return <Select label={field.label} value={asString(value, field.options?.[0]?.value ?? '')} options={field.options ?? []} onChange={(e) => set(e.target.value)} error={own} hint={field.help} />;
    case 'model': {
      return <ModelSelect label={field.label} value={asString(value)} onChange={set} error={own} />;
    }
    case 'image': {
      const hasAltField = field.key === 'imageUrl' && SECTION_META[sectionType].fields.some((f) => f.key === 'imageAlt');
      return <ImageField label={field.label} value={asString(value)} onChange={set} error={own} hint={field.help} onAlt={hasAltField ? (alt) => !asString(props.imageAlt) && setProp('imageAlt', alt) : undefined} />;
    }
    case 'link':
      return <TextControl label={field.label} value={asString(value)} onChange={set} error={own} hint={field.help ?? LINK_HINT} max={500} placeholder="/memberships" />;
    case 'datetime': {
      const id = `dt-${field.key}`;
      const v = asString(value);
      return (
        <div>
          <LabelRow htmlFor={id} label={field.label} right={v ? <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => set('')}>Clear</button> : undefined} />
          <input id={id} type="datetime-local" className="input" value={isoToLocalInput(v)} onChange={(e) => set(localInputToIso(e.target.value))} aria-invalid={own ? true : undefined} />
          <FieldError>{own}</FieldError>
          <Hint>{!own && (field.help ?? 'Shown in your local time. Leave empty for no countdown.')}</Hint>
        </div>
      );
    }
    case 'ctas':
      return <CtasEditor label={field.label} value={value} onChange={set} errors={{ ...nested, ...(own ? { '': own } : {}) }} max={max ?? 3} />;
    case 'cta':
      return <CtaEditor label={field.label} value={value} onChange={set} errors={nested} />;
    case 'scene':
      return (
        <div>
          <span className="label">{field.label}</span>
          <SceneEditor value={value} onChange={set} errors={nested} fallback={sectionType === 'equipment3d' ? { modelId: 'dumbbell' } : undefined} />
          <FieldError>{own}</FieldError>
        </div>
      );
    case 'stringList':
      return <StringListEditor label={field.label} value={value} onChange={set} errors={nested} max={max ?? 8} />;
    case 'statItems':
      return <StatItemsEditor label={field.label} value={value} onChange={set} errors={{ ...nested, ...(own ? { '': own } : {}) }} />;
    case 'equipmentItems':
      return <EquipmentItemsEditor label={field.label} value={value} onChange={set} errors={{ ...nested, ...(own ? { '': own } : {}) }} />;
    case 'galleryImages':
      return <GalleryImagesEditor label={field.label} value={value} onChange={set} errors={nested} max={max ?? 24} />;
    case 'background':
      return <BackgroundEditor label={field.label} value={value} onChange={set} errors={nested} />;
    default:
      return null;
  }
}

function ModelSelect({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const options = useModelOptions(value);
  return <Select label={label} value={value} options={options} onChange={(e) => onChange(e.target.value)} error={error} />;
}
