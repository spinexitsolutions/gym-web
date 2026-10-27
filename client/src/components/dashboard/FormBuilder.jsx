import { useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../services/api.js';
import { Field, Input, Textarea, Select } from '../../forms/Field.jsx';
import { TagInput } from '../../forms/TagInput.jsx';
import { ImageUpload } from './ImageUpload.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../utils/cn.js';

const errorAt = (errors, path) => path.split('.').reduce((o, k) => o?.[k], errors)?.message;

// Loads select options from an API list endpoint, e.g. { endpoint: '/admin/trainers?limit=100', label: 'name' }.
function useOptions(source) {
  return useQuery({
    queryKey: ['options', source?.endpoint],
    queryFn: async () => (await api.get(source.endpoint)).data.map((x) => ({ value: x._id || x.id, label: typeof source.label === 'function' ? source.label(x) : x[source.label] })),
    enabled: Boolean(source?.endpoint),
    staleTime: 60_000,
  });
}

function MultiCheck({ id, value = [], onChange, options }) {
  return (
    <div id={id} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn('rounded-full border px-3 py-1.5 text-xs transition', on ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>{o.label}</button>
        );
      })}
      {!options.length && <span className="text-xs text-muted">No options yet</span>}
    </div>
  );
}

function RefField({ f, name, control, errors }) {
  const opts = useOptions(f.source);
  const options = [...(f.options || []), ...(opts.data || [])];
  return (
    <Field label={f.label} hint={f.hint} error={errorAt(errors, name)} required={f.required} className={f.wide ? 'sm:col-span-2' : ''}>
      {(a) => (
        <Controller control={control} name={name} render={({ field }) => (f.type === 'multiref'
          ? <MultiCheck {...a} value={field.value || []} onChange={field.onChange} options={options} />
          : (
            <Select {...a} value={field.value || ''} onChange={(e) => field.onChange(e.target.value || null)}>
              <option value="">{f.placeholder || '— Select —'}</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))} />
      )}
    </Field>
  );
}

function Repeater({ f, name, control, register, errors }) {
  const { fields, append, remove, move } = useFieldArray({ control, name });
  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{f.label}</legend>
      {f.hint && <p className="-mt-1 text-xs text-muted">{f.hint}</p>}
      {fields.map((item, i) => (
        <div key={item.id} className="rounded-brand border border-line/10 bg-elevated/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">{f.itemLabel || 'Item'} {i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted hover:text-danger" onClick={() => remove(i)} aria-label={`Remove ${f.itemLabel || 'item'} ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {f.fields.map((sub) => <FieldRenderer key={sub.name} f={sub} name={`${name}.${i}.${sub.name}`} control={control} register={register} errors={errors} />)}
          </div>
        </div>
      ))}
      {errorAt(errors, name) && <p className="text-xs text-danger" role="alert">{errorAt(errors, name)}</p>}
      <Button type="button" size="sm" variant="subtle" onClick={() => append(f.newItem ? f.newItem() : {})} disabled={f.max && fields.length >= f.max}>
        <Plus className="h-4 w-4" aria-hidden />Add {f.itemLabel?.toLowerCase() || 'item'}
      </Button>
    </fieldset>
  );
}

function ShowIf({ control, when, children }) {
  const values = useWatch({ control });
  return when(values) ? children : null;
}

/**
 * Field types: text, email, url, number, money (₹ in UI, paise in data), percent, textarea, markdown, select, ref, multiref,
 * checkbox, date, datetime, tags, image, video, icon, color, time, repeater. Optional: showIf(values) => boolean.
 */
export function FieldRenderer({ f, name = f.name, control, register, errors }) {
  const wide = f.wide || ['textarea', 'markdown', 'image', 'video', 'repeater', 'tags'].includes(f.type);
  const cls = wide ? 'sm:col-span-2' : '';
  const err = errorAt(errors, name);
  let node;
  switch (f.type) {
    case 'repeater':
      node = <Repeater f={f} name={name} control={control} register={register} errors={errors} />; break;
    case 'ref': case 'multiref':
      node = <RefField f={f} name={name} control={control} errors={errors} />; break;
    case 'checkbox':
      node = (
        <label className={cn('flex items-start gap-3 text-sm', cls)}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" {...register(name)} />
          <span>{f.label}{f.hint && <span className="block text-xs text-muted">{f.hint}</span>}</span>
        </label>
      ); break;
    case 'image': case 'video': case 'icon':
      node = (
        <div className={cls}>
          <Controller control={control} name={name} render={({ field }) => <ImageUpload kind={f.type} folder={f.folder} label={f.label} value={field.value} onChange={field.onChange} withAlt={f.type === 'image'} />} />
          {err && <p className="mt-1 text-xs text-danger" role="alert">{err}</p>}
        </div>
      ); break;
    case 'tags':
      node = (
        <Field label={f.label} hint={f.hint || 'Press Enter to add'} error={err} className={cls}>
          {(a) => <Controller control={control} name={name} render={({ field }) => <TagInput {...a} value={field.value || []} onChange={field.onChange} placeholder={f.placeholder} max={f.max || 20} />} />}
        </Field>
      ); break;
    case 'money':
      node = (
        <Field label={`${f.label} (₹)`} hint={f.hint} error={err} required={f.required} className={cls}>
          {(a) => (
            <Controller control={control} name={name} render={({ field }) => (
              <Input {...a} type="number" inputMode="decimal" min="0" step="1" value={field.value === undefined || field.value === null || field.value === '' ? '' : field.value / 100}
                onChange={(e) => field.onChange(e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100))} />
            )} />
          )}
        </Field>
      ); break;
    case 'select':
      node = (
        <Field label={f.label} hint={f.hint} error={err} required={f.required} className={cls}>
          {(a) => <Select {...a} {...register(name)}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>}
        </Field>
      ); break;
    case 'textarea': case 'markdown':
      node = (
        <Field label={f.label} hint={f.hint || (f.type === 'markdown' ? 'Markdown supported: **bold**, ## headings, - lists, [links](https://…)' : undefined)} error={err} required={f.required} className={cls}>
          {(a) => <Textarea {...a} rows={f.rows || (f.type === 'markdown' ? 14 : 4)} className={f.type === 'markdown' ? 'font-mono text-xs' : ''} maxLength={f.maxLength} {...register(name)} />}
        </Field>
      ); break;
    case 'color':
      node = (
        <Field label={f.label} hint={f.hint} error={err} className={cls}>
          {(a) => (
            <Controller control={control} name={name} render={({ field }) => (
              <div className="flex gap-2">
                <input type="color" aria-label={`${f.label} picker`} className="h-12 w-14 cursor-pointer rounded-brand border border-line/15 bg-surface p-1" value={field.value || '#000000'} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                <Input {...a} value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} placeholder="#C9A54C" />
              </div>
            )} />
          )}
        </Field>
      ); break;
    default: {
      const type = { number: 'number', percent: 'number', date: 'date', datetime: 'datetime-local', email: 'email', url: 'url', time: 'time' }[f.type] || 'text';
      const valueAs = ['number', 'percent'].includes(f.type) ? { setValueAs: (v) => (v === '' ? undefined : Number(v)) } : {};
      node = (
        <Field label={f.label} hint={f.hint} error={err} required={f.required} className={cls}>
          {(a) => <Input {...a} type={type} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step} maxLength={f.maxLength} {...register(name, valueAs)} />}
        </Field>
      );
    }
  }
  return f.showIf ? <ShowIf control={control} when={f.showIf}>{node}</ShowIf> : node;
}

export function FormFields({ fields, control, register, errors }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((f) => (f.section
        ? <h3 key={f.section} className="eyebrow pt-4 sm:col-span-2">{f.section}</h3>
        : <FieldRenderer key={f.name} f={f} control={control} register={register} errors={errors} />))}
    </div>
  );
}
