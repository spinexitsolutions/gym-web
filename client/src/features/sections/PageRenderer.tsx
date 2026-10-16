import { Component, useMemo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SECTION_META, sectionPropsSchemas, type DraftSection, type SectionType } from '@apex/shared';
import { SECTION_RENDERERS } from './registry';
import { RenderContext } from './primitives';
import '@/components/layout/public.css';

interface Props {
  sections: DraftSection[];
  /** Admin preview: shows warnings for invalid sections and placeholders for empty data. */
  preview?: boolean;
}

function WarningCard({ title, issues }: { title: string; issues: string[] }) {
  return (
    <div className="container py-6">
      <div role="note" className="rounded-theme border border-warning/40 bg-warning/5 px-5 py-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" aria-hidden /> {title} — hidden on the live site
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-6 text-fg/80">
          {issues.slice(0, 6).map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Isolates a crashing section so the rest of the page still renders. */
class SectionBoundary extends Component<{ preview: boolean; label: string; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    console.error(`[sections] ${this.props.label} failed to render`, error);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return this.props.preview ? <WarningCard title={`${this.props.label} failed to render`} issues={[this.state.error.message]} /> : null;
  }
}

/**
 * Renders an ordered list of CMS sections. Each section's props are validated with its zod
 * schema (defaults applied); invalid or disabled sections are skipped on the live site.
 */
export function PageRenderer({ sections, preview = false }: Props) {
  const parsed = useMemo(
    () =>
      sections.map((s) => {
        const schema = sectionPropsSchemas[s.type as SectionType];
        if (!schema) return { s, ok: false as const, issues: [`Unknown section type “${s.type}”`] };
        const r = schema.safeParse(s.props ?? {});
        return r.success ? { s, ok: true as const, props: r.data } : { s, ok: false as const, issues: r.error.issues.map((i) => `${i.path.join('.') || 'props'}: ${i.message}`) };
      }),
    [sections],
  );
  const ctx = useMemo(() => ({ preview }), [preview]);
  const firstIsHero = parsed.find((x) => x.s.enabled && x.ok)?.s.type === 'hero';

  return (
    <RenderContext.Provider value={ctx}>
      {/* Pages that don't open with a hero still need to clear the fixed header. */}
      {!firstIsHero && <div aria-hidden className="h-[var(--chrome-h,6rem)]" />}
      {parsed.map((x) => {
        const label = SECTION_META[x.s.type as SectionType]?.label ?? x.s.type;
        if (!x.s.enabled) return null;
        if (!x.ok) return preview ? <WarningCard key={x.s.id} title={`${label} section has invalid settings`} issues={x.issues} /> : null;
        const R = SECTION_RENDERERS[x.s.type as SectionType] as unknown as React.ComponentType<{ p: unknown }>;
        return (
          <SectionBoundary key={x.s.id} preview={preview} label={label}>
            <R p={x.props} />
          </SectionBoundary>
        );
      })}
    </RenderContext.Provider>
  );
}

export default PageRenderer;
