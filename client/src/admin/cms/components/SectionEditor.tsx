import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Database, Eye, EyeOff } from 'lucide-react';
import { SECTION_META, type DraftSection, type FieldDef } from '@apex/shared';
import { Switch } from '@/components/ui';
import { FieldControl, type ErrorMap } from './FieldControls';
import { DATA_SOURCE_LINKS, SECTION_ICONS } from './sectionIcons';

const TAIL_KEYS = new Set(['background', 'anchorId']);

/** Hides fields that don't apply given other values (keeps the form focused). */
function isVisible(section: DraftSection, f: FieldDef): boolean {
  if (section.type === 'hero' && f.key === 'scene') return (section.props.mediaType ?? 'scene') === 'scene';
  return true;
}

/** Field-driven editor generated from SECTION_META[type].fields. */
export function SectionEditor({ section, onChange, errors }: { section: DraftSection; onChange: (s: DraftSection) => void; errors: ErrorMap }) {
  const meta = SECTION_META[section.type];
  const Icon = SECTION_ICONS[section.type];
  const setProp = (key: string, value: unknown) => {
    const props = { ...section.props };
    if (value === undefined) delete props[key];
    else props[key] = value;
    onChange({ ...section, props });
  };
  const fields = meta.fields.filter((f) => isVisible(section, f));
  const main = fields.filter((f) => !TAIL_KEYS.has(f.key));
  const tail = fields.filter((f) => TAIL_KEYS.has(f.key));
  const fieldKeys = new Set(meta.fields.map((f) => f.key));
  // Issues that don't belong to a visible field (e.g. id, or a hidden field) are listed at the top.
  const orphan = Object.entries(errors).filter(([path]) => {
    const root = path.split('.')[0];
    return !fieldKeys.has(root) || !fields.some((f) => f.key === root);
  });
  const source = meta.dataSource ? DATA_SOURCE_LINKS[meta.dataSource] : undefined;
  const errorCount = Object.keys(errors).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold leading-tight">{meta.label}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{meta.description}</p>
        </div>
      </div>

      <div className="rounded-theme-sm border border-line bg-bg/40 px-3.5 py-3">
        <Switch
          label={
            <span className="inline-flex items-center gap-1.5">
              {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Visible on page
            </span>
          }
          description={section.enabled ? 'Shown to visitors once published.' : 'Hidden — kept in the draft but not rendered.'}
          checked={section.enabled}
          onChange={(v) => onChange({ ...section, enabled: v })}
        />
      </div>

      {meta.dataSource && (
        <div className="flex gap-2.5 rounded-theme-sm border border-sky-400/25 bg-sky-400/[0.06] px-3.5 py-3 text-xs">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <p className="text-fg/80">
            Items come from <strong className="text-fg">{meta.dataSource}</strong>. Edit them in{' '}
            {source ? (
              <Link to={source.to} target="_blank" className="inline-flex items-center gap-0.5 font-medium text-sky-300 hover:underline">
                {source.label}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : (
              'the admin'
            )}
            ; this section controls the heading and how many to show.
          </p>
        </div>
      )}

      {errorCount > 0 && (
        <div role="alert" className="flex gap-2.5 rounded-theme-sm border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-fg">
              {errorCount} issue{errorCount > 1 ? 's' : ''} must be fixed before this page can be published.
            </p>
            {orphan.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-fg/75">
                {orphan.map(([p, m]) => (
                  <li key={p}>
                    <code className="text-[0.7rem]">{p || 'section'}</code>: {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {main.map((f) => (
          <FieldControl key={f.key} sectionType={section.type} field={f} props={section.props} setProp={setProp} errors={errors} />
        ))}
      </div>

      {tail.length > 0 && (
        <div className="space-y-5 border-t border-line/70 pt-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">Layout</p>
          {tail.map((f) => (
            <FieldControl key={f.key} sectionType={section.type} field={f} props={section.props} setProp={setProp} errors={errors} />
          ))}
          {fieldKeys.has('anchorId') && (
            <p className="-mt-2 text-xs text-muted">
              Link to this section with <code className="rounded bg-fg/10 px-1">#{String(section.props.anchorId || 'your-anchor')}</code>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
