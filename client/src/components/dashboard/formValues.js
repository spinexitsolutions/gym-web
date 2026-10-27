// Converts API documents ⇄ form values using the same field config the FormBuilder renders.
// Field names may be dot paths ("limits.classesPerWeek", "seo.title").
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id : v);

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  keys.slice(0, -1).forEach((k) => { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
  cur[keys.at(-1)] = value;
  return obj;
}

export function docToForm(fields, doc = {}, defaults = {}) {
  const out = structuredClone(defaults);
  const seen = new Set();
  for (const f of fields) {
    if (f.section || seen.has(f.name)) continue;
    seen.add(f.name);
    const raw = getPath(doc, f.name);
    const v = raw === undefined ? getPath(defaults, f.name) : raw;
    if (v === undefined) continue;
    let val;
    switch (f.type) {
      case 'datetime': val = toLocalInput(v); break;
      case 'date': val = v ? String(v).slice(0, 10) : ''; break;
      case 'ref': val = idOf(v) || ''; break;
      case 'multiref': val = (v || []).map(idOf); break;
      case 'repeater': val = (v || []).map((item) => docToForm(f.fields, item)); break;
      default: val = v;
    }
    setPath(out, f.name, val);
  }
  return out;
}

export function formToPayload(fields, values) {
  const out = {};
  const seen = new Set();
  for (const f of fields) {
    if (f.section || f.readOnly || seen.has(f.name)) continue;
    seen.add(f.name);
    let v = getPath(values, f.name);
    switch (f.type) {
      case 'datetime': v = v ? new Date(v).toISOString() : null; break; // browser local time → UTC
      case 'date': v = v || undefined; break; // never send null: the API would coerce it to 1970
      case 'number': case 'percent': case 'money': v = v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v); break;
      case 'select': v = v !== '' && v !== undefined && f.options?.some((o) => typeof o.value === 'number') ? Number(v) : v; break;
      case 'ref': v = v || null; break;
      case 'repeater': v = (v || []).map((item) => formToPayload(f.fields, item)); break;
      case 'image': case 'video': case 'icon': v = v?.url ? v : undefined; break;
      default:
    }
    if (v !== undefined) setPath(out, f.name, v);
  }
  return out;
}
