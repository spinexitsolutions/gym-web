import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, History, Moon, Palette, RotateCcw, Rocket, Save, Sun } from 'lucide-react';
import { FONT_OPTIONS, themeTokensSchema, type ThemeTokens } from '@apex/shared';
import { Badge, Button, ConfirmDialog, ErrorState, Modal, PageHeader, PageLoader, Switch, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime } from '@/lib/format';
import { loadFonts, themeToCssVars } from '@/lib/theme';
import { FieldError, Hint, LabelRow, RangeField, SaveIndicator, Segmented, type SaveState } from './components/bits';
import { PreviewFrame } from './components/PreviewFrame';
import type { ThemeDoc } from './components/types';
import { contrastRatio, HEX_RE, onPrimaryFor, useUnsavedChangesWarning } from './components/utils';

type Colors = ThemeTokens['colors'];
const COLOR_FIELDS: { key: keyof Colors; label: string; help: string }[] = [
  { key: 'primary', label: 'Primary', help: 'Buttons, links, highlights' },
  { key: 'accent', label: 'Accent', help: 'Secondary highlights' },
  { key: 'secondary', label: 'Secondary', help: 'Supporting UI tone' },
  { key: 'background', label: 'Background', help: 'Page background' },
  { key: 'surface', label: 'Surface', help: 'Cards and panels' },
  { key: 'text', label: 'Text', help: 'Main text colour' },
  { key: 'muted', label: 'Muted text', help: 'Captions, hints' },
  { key: 'border', label: 'Border', help: 'Dividers and outlines' },
  { key: 'success', label: 'Success', help: 'Confirmations' },
  { key: 'warning', label: 'Warning', help: 'Cautions' },
  { key: 'danger', label: 'Danger', help: 'Errors, destructive actions' },
];

/** Applies a theme to a wrapper element so `.btn` / `.card` and Tailwind tokens render with the draft. */
export function themeScopeProps(t: ThemeTokens): { style: CSSProperties; 'data-btn': string; 'data-card': string; 'data-mode': string; 'data-glow': string } {
  return { style: themeToCssVars(t) as CSSProperties, 'data-btn': t.buttonStyle, 'data-card': t.cardStyle, 'data-mode': t.mode, 'data-glow': String(t.effects.glow) };
}

function ColorInput({ label, help, value, onChange, error }: { label: string; help?: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = HEX_RE.test(text);
  return (
    <div>
      <LabelRow htmlFor={`${id}-hex`} label={label} />
      <div className={cn('flex items-center gap-2 rounded-theme-sm border bg-bg/60 p-1.5 pr-2', !valid || error ? 'border-danger/70' : 'border-line focus-within:border-primary/70')}>
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md ring-1 ring-fg/15" style={{ background: valid ? text : value }}>
          <input type="color" value={valid ? text.toLowerCase() : value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} colour picker`} />
        </span>
        <input
          id={`${id}-hex`}
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = `#${v}`;
            setText(v);
            if (HEX_RE.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => !HEX_RE.test(text) && setText(value)}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase outline-none"
          aria-invalid={!valid || error ? true : undefined}
          aria-describedby={`${id}-help`}
        />
      </div>
      {!valid ? <FieldError>Use a 6-digit hex colour such as #c6ff3d</FieldError> : error ? <FieldError>{error}</FieldError> : help ? <p id={`${id}-help`} className="mt-1 text-[0.7rem] text-muted">{help}</p> : null}
    </div>
  );
}

function Panel({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Visual option tiles (radio group). */
function OptionTiles<T extends string>({ label, value, onChange, options, columns = 4 }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; preview: ReactNode }[]; columns?: number }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn('flex flex-col items-center gap-2 rounded-theme-sm border p-2.5 text-xs transition', value === o.value ? 'border-primary/70 bg-primary/[0.07] text-fg' : 'border-line text-muted hover:border-fg/25 hover:text-fg')}
          >
            <span className="grid h-10 w-full place-items-center">{o.preview}</span>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function contrastIssues(t: ThemeTokens): string[] {
  const c = t.colors;
  const out: string[] = [];
  const check = (a: string, b: string, min: number, msg: string) => {
    const r = contrastRatio(a, b);
    if (r < min) out.push(`${msg} — contrast ${r.toFixed(2)}:1 (needs ${min}:1)`);
  };
  check(c.text, c.background, 4.5, 'Text on background');
  check(c.text, c.surface, 4.5, 'Text on surface (cards)');
  check(c.muted, c.background, 3, 'Muted text on background');
  check(onPrimaryFor(c.primary), c.primary, 4.5, 'Button text on primary');
  return out;
}

export default function ThemePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['cms-theme'], queryFn: () => api.get<ThemeDoc>('/themes'), refetchOnWindowFocus: false });
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);
  const [presetId, setPresetId] = useState<string | undefined>();
  const [base, setBase] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'publish' | 'reset' | 'restore'>('');
  const [resetOpen, setResetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'site' | 'components'>('site');

  const load = (doc: ThemeDoc) => {
    setTokens(doc.draft);
    setPresetId(doc.presetId);
    setBase(JSON.stringify(doc.draft));
    setSaveState('saved');
    setServerErrors({});
    qc.setQueryData(['cms-theme'], doc);
  };
  useEffect(() => {
    if (q.data && tokens === null) load(q.data);
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tokens) loadFonts(tokens);
  }, [tokens?.fonts.heading, tokens?.fonts.body]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = tokens !== null && JSON.stringify(tokens) !== base;
  useEffect(() => {
    if (dirty && saveState !== 'saving') setSaveState('unsaved');
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useUnsavedChangesWarning(dirty);

  const validation = useMemo(() => {
    if (!tokens) return {} as Record<string, string>;
    const r = themeTokensSchema.safeParse(tokens);
    const m: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) m[i.path.join('.')] = i.message;
    return { ...serverErrors, ...m };
  }, [tokens, serverErrors]);
  const invalid = Object.keys(validation).length > 0;
  const contrast = useMemo(() => (tokens ? contrastIssues(tokens) : []), [tokens]);
  const payload = useMemo(() => ({ theme: tokens ?? undefined }), [tokens]);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!tokens || !q.data) return <PageLoader label="Loading theme" />;
  const doc = q.data;

  const set = <K extends keyof ThemeTokens>(k: K, v: ThemeTokens[K]) => {
    setTokens({ ...tokens, [k]: v });
    setPresetId(undefined);
  };
  const setColor = (k: keyof Colors, v: string) => set('colors', { ...tokens.colors, [k]: v });

  const save = async (): Promise<boolean> => {
    if (invalid) {
      toast.error('Fix the highlighted fields first');
      return false;
    }
    setSaveState('saving');
    try {
      const res = await api.put<ThemeDoc>('/themes/draft', { tokens, presetId });
      load(res);
      return true;
    } catch (err) {
      setSaveState('error');
      if (err instanceof ApiError) setServerErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k.replace(/^tokens\./, ''), v])));
      toast.error(err);
      return false;
    }
  };
  const run = async (kind: typeof busy, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };
  const publish = () =>
    run('publish', async () => {
      if (dirty && !(await save())) return;
      const res = await api.post<ThemeDoc>('/themes/publish');
      load(res);
      void qc.invalidateQueries({ queryKey: ['site'] });
      toast.success('Theme published', 'The live site now uses this theme.');
    });

  const unpublished = dirty || doc.hasUnpublishedChanges;
  const scope = themeScopeProps(tokens);

  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Theme & brand"
        description="Colours, typography and component styles for the public website. Changes are previewed live and go public only when you publish."
        actions={
          <>
            <SaveIndicator state={saveState} />
            {unpublished && <Badge tone="warning">Unpublished changes</Badge>}
            <Button variant="ghost" size="sm" icon={<History className="h-4 w-4" />} onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setResetOpen(true)}>
              Reset
            </Button>
            <Button variant="secondary" size="sm" icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={saveState === 'saving' && busy !== 'publish'} onClick={() => void run('save', async () => void ((await save()) && toast.success('Theme draft saved')))}>
              Save draft
            </Button>
            <Button size="sm" icon={<Rocket className="h-4 w-4" />} disabled={invalid || (!unpublished && !dirty)} loading={busy === 'publish'} onClick={() => void publish()}>
              Publish
            </Button>
          </>
        }
      />
      <p className="-mt-3 mb-6 text-xs text-muted">{doc.publishedAt ? `Live theme published ${fmtDateTime(doc.publishedAt)}` : 'Using the default theme'}</p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Presets" description="Start from a curated look, then fine-tune. Loads into the draft only.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {doc.presets.map((p) => {
                const active = presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setTokens(p.tokens);
                      setPresetId(p.id);
                    }}
                    aria-pressed={active}
                    className={cn('group overflow-hidden rounded-theme-sm border text-left transition hover:-translate-y-0.5', active ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-fg/30')}
                  >
                    <span className="block h-16 p-2.5" style={{ background: p.tokens.colors.background }}>
                      <span className="block h-2 w-10 rounded-full" style={{ background: p.tokens.colors.text, opacity: 0.85 }} />
                      <span className="mt-1.5 block h-1.5 w-14 rounded-full" style={{ background: p.tokens.colors.muted }} />
                      <span className="mt-2 inline-block h-4 w-12 rounded-full" style={{ background: `linear-gradient(${p.tokens.gradient.angle}deg, ${p.tokens.gradient.from}, ${p.tokens.gradient.to})` }} />
                    </span>
                    <span className="flex items-center justify-between gap-1 border-t border-line bg-bg/40 px-2.5 py-2 text-xs font-medium">
                      {p.label}
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Mode & colours"
            action={
              <Segmented
                label="Colour mode"
                size="sm"
                value={tokens.mode}
                onChange={(v) => set('mode', v)}
                options={[
                  { value: 'dark', label: <><Moon className="h-3.5 w-3.5" /> Dark</> },
                  { value: 'light', label: <><Sun className="h-3.5 w-3.5" /> Light</> },
                ]}
              />
            }
          >
            {contrast.length > 0 && (
              <div role="alert" className="mb-4 flex gap-2.5 rounded-theme-sm border border-warning/35 bg-warning/[0.07] p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-fg">Readability warning (WCAG AA)</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fg/75">
                    {contrast.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {COLOR_FIELDS.map((f) => (
                <ColorInput key={f.key} label={f.label} help={f.help} value={tokens.colors[f.key]} onChange={(v) => setColor(f.key, v)} error={validation[`colors.${f.key}`]} />
              ))}
            </div>
          </Panel>

          <Panel title="Brand gradient" description="Used by gradient buttons, highlights and the gradient section background.">
            <div className="mb-4 h-14 rounded-theme-sm ring-1 ring-line" style={{ background: `linear-gradient(${tokens.gradient.angle}deg, ${tokens.gradient.from}, ${tokens.gradient.to})` }} aria-hidden />
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="From" value={tokens.gradient.from} onChange={(v) => set('gradient', { ...tokens.gradient, from: v })} error={validation['gradient.from']} />
              <ColorInput label="To" value={tokens.gradient.to} onChange={(v) => set('gradient', { ...tokens.gradient, to: v })} error={validation['gradient.to']} />
            </div>
            <div className="mt-4">
              <RangeField label="Angle" min={0} max={360} value={tokens.gradient.angle} onChange={(v) => set('gradient', { ...tokens.gradient, angle: v })} format={(v) => `${v}°`} />
            </div>
          </Panel>

          <Panel title="Typography" description="Fonts are loaded from Google Fonts (allow-listed).">
            <div className="space-y-4">
              {(['heading', 'body'] as const).map((k) => (
                <div key={k}>
                  <LabelRow htmlFor={`font-${k}`} label={k === 'heading' ? 'Heading font' : 'Body font'} />
                  <select id={`font-${k}`} className="input" value={tokens.fonts[k]} onChange={(e) => set('fonts', { ...tokens.fonts, [k]: e.target.value } as ThemeTokens['fonts'])}>
                    {FONT_OPTIONS[k].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <p className={cn('mt-2 truncate rounded-theme-sm bg-fg/[0.04] px-3 py-2', k === 'heading' ? 'text-2xl font-semibold tracking-tight' : 'text-sm')} style={{ fontFamily: `'${tokens.fonts[k]}', sans-serif` }}>
                    {k === 'heading' ? 'Forge the strongest you' : 'Elite coaching, precision equipment and a training floor engineered for results.'}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Shape & components">
            <div className="space-y-5">
              <RangeField label="Corner radius" min={0} max={32} value={tokens.radius} onChange={(v) => set('radius', v)} format={(v) => `${v}px`} hint="Cards, inputs and images." />
              <OptionTiles
                label="Button shape"
                value={tokens.buttonShape}
                onChange={(v) => set('buttonShape', v)}
                columns={3}
                options={(['pill', 'rounded', 'square'] as const).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), preview: <span className="h-6 w-16 bg-primary" style={{ borderRadius: v === 'pill' ? 999 : v === 'rounded' ? 8 : 2 }} /> }))}
              />
              <OptionTiles
                label="Button style"
                value={tokens.buttonStyle}
                onChange={(v) => set('buttonStyle', v)}
                options={(['solid', 'outline', 'gradient', 'glass'] as const).map((v) => ({
                  value: v,
                  label: v[0].toUpperCase() + v.slice(1),
                  preview: (
                    <span
                      className="h-6 w-14 rounded-full"
                      style={
                        v === 'solid'
                          ? { background: tokens.colors.primary }
                          : v === 'outline'
                            ? { boxShadow: `inset 0 0 0 1.5px ${tokens.colors.primary}` }
                            : v === 'gradient'
                              ? { background: `linear-gradient(${tokens.gradient.angle}deg, ${tokens.gradient.from}, ${tokens.gradient.to})` }
                              : { background: `${tokens.colors.primary}29`, boxShadow: `inset 0 0 0 1px ${tokens.colors.primary}80` }
                      }
                    />
                  ),
                }))}
              />
              <OptionTiles
                label="Card style"
                value={tokens.cardStyle}
                onChange={(v) => set('cardStyle', v)}
                options={(['glass', 'solid', 'outline', 'elevated'] as const).map((v) => ({
                  value: v,
                  label: v[0].toUpperCase() + v.slice(1),
                  preview: (
                    <span
                      className="h-9 w-14 rounded-md"
                      style={
                        v === 'glass'
                          ? { background: 'linear-gradient(180deg, rgb(255 255 255 / .12), rgb(255 255 255 / .04))', border: '1px solid rgb(255 255 255 / .12)' }
                          : v === 'solid'
                            ? { background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}` }
                            : v === 'outline'
                              ? { border: `1px solid ${tokens.colors.border}` }
                              : { background: tokens.colors.surface, boxShadow: '0 8px 18px -6px rgb(0 0 0 / .6)' }
                      }
                    />
                  ),
                }))}
              />
              <OptionTiles
                label="Shadow"
                value={tokens.shadow}
                onChange={(v) => set('shadow', v)}
                columns={3}
                options={(['none', 'soft', 'dramatic'] as const).map((v) => ({
                  value: v,
                  label: v[0].toUpperCase() + v.slice(1),
                  preview: <span className="h-7 w-12 rounded-md bg-fg/15" style={{ boxShadow: v === 'none' ? 'none' : v === 'soft' ? '0 6px 14px -6px rgb(0 0 0 / .45)' : '0 14px 24px -8px rgb(0 0 0 / .9)' }} />,
                }))}
              />
              <OptionTiles
                label="Section spacing"
                value={tokens.spacing}
                onChange={(v) => set('spacing', v)}
                columns={3}
                options={(['compact', 'comfortable', 'spacious'] as const).map((v) => ({
                  value: v,
                  label: v[0].toUpperCase() + v.slice(1),
                  preview: (
                    <span className="flex flex-col items-center" style={{ gap: v === 'compact' ? 3 : v === 'comfortable' ? 7 : 11 }}>
                      <span className="h-1.5 w-12 rounded-full bg-fg/30" />
                      <span className="h-1.5 w-12 rounded-full bg-fg/30" />
                    </span>
                  ),
                }))}
              />
            </div>
          </Panel>

          <Panel title="Effects">
            <div className="space-y-4">
              <Switch label="Custom cursor" description="Magnetic cursor on desktop (auto-disabled for touch & reduced motion)." checked={tokens.effects.customCursor} onChange={(v) => set('effects', { ...tokens.effects, customCursor: v })} />
              <Switch label="Film grain" description="Subtle texture overlay." checked={tokens.effects.grain} onChange={(v) => set('effects', { ...tokens.effects, grain: v })} />
              <Switch label="Glow" description="Soft glow on primary buttons and highlights." checked={tokens.effects.glow} onChange={(v) => set('effects', { ...tokens.effects, glow: v })} />
            </div>
          </Panel>

          <Panel title="Header & footer">
            <div className="space-y-4">
              <Switch label="Transparent header over the hero" checked={tokens.header.transparentOnTop} onChange={(v) => set('header', { ...tokens.header, transparentOnTop: v })} />
              <Switch label="Show login link" checked={tokens.header.showLogin} onChange={(v) => set('header', { ...tokens.header, showLogin: v })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <LabelRow htmlFor="h-cta-label" label="Header button label" right={<span className="text-[0.7rem] text-muted">{tokens.header.ctaLabel.length} / 24</span>} />
                  <input id="h-cta-label" className="input" maxLength={24} value={tokens.header.ctaLabel} onChange={(e) => set('header', { ...tokens.header, ctaLabel: e.target.value })} />
                  <Hint>Leave empty to hide the button.</Hint>
                </div>
                <div>
                  <LabelRow htmlFor="h-cta-href" label="Header button link" />
                  <input id="h-cta-href" className="input" value={tokens.header.ctaHref} onChange={(e) => set('header', { ...tokens.header, ctaHref: e.target.value })} aria-invalid={validation['header.ctaHref'] ? true : undefined} />
                  <FieldError>{validation['header.ctaHref']}</FieldError>
                </div>
              </div>
              <div>
                <LabelRow htmlFor="f-tagline" label="Footer tagline" right={<span className="text-[0.7rem] text-muted">{tokens.footer.tagline.length} / 200</span>} />
                <textarea id="f-tagline" rows={3} className="input resize-y" maxLength={200} value={tokens.footer.tagline} onChange={(e) => set('footer', { ...tokens.footer, tagline: e.target.value })} />
              </div>
              <Switch label="Newsletter signup in footer" checked={tokens.footer.showNewsletter} onChange={(v) => set('footer', { ...tokens.footer, showNewsletter: v })} />
            </div>
          </Panel>
        </div>

        {/* Preview column */}
        <div className="xl:sticky xl:top-20 xl:h-[calc(100dvh-6.5rem)]">
          <div className="card flex h-[75vh] flex-col overflow-hidden xl:h-full">
            {previewTab === 'site' ? (
              <PreviewFrame
                src="/preview/home-theme?themePreview=1"
                payload={payload}
                className="h-full"
                title="Theme preview"
                toolbarLeft={<Segmented label="Preview type" size="sm" value={previewTab} onChange={setPreviewTab} options={[{ value: 'site', label: 'Home page' }, { value: 'components', label: 'Components' }]} />}
              />
            ) : (
              <>
                <div className="flex items-center border-b border-line/70 px-3 py-2">
                  <Segmented label="Preview type" size="sm" value={previewTab} onChange={setPreviewTab} options={[{ value: 'site', label: 'Home page' }, { value: 'components', label: 'Components' }]} />
                </div>
                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                  <ComponentSampler tokens={tokens} scope={scope} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        loading={busy === 'reset'}
        title="Reset draft to the default theme?"
        description="Replaces the draft with the default “Titanium Lime” theme. The live site is unchanged until you publish."
        confirmLabel="Reset draft"
        onConfirm={() =>
          void run('reset', async () => {
            load(await api.post<ThemeDoc>('/themes/reset-draft'));
            setResetOpen(false);
            toast.success('Draft reset to default');
          })
        }
      />
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Theme history" description="Previously published themes. Restoring loads one into the draft for review.">
        {doc.history.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No earlier published themes yet.</p>
        ) : (
          <ul className="space-y-2">
            {doc.history.map((h) => (
              <li key={h.index} className="flex items-center gap-3 rounded-theme-sm border border-line bg-bg/40 p-3">
                <Palette className="h-4 w-4 text-muted" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">Published {fmtDateTime(h.publishedAt)}</p>
                  <p className="text-xs text-muted">{relativeTime(h.publishedAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === 'restore'}
                  onClick={() =>
                    void run('restore', async () => {
                      load(await api.post<ThemeDoc>(`/themes/history/${h.index}/restore`));
                      setHistoryOpen(false);
                      toast.success('Loaded into draft', 'Review the preview, then publish.');
                    })
                  }
                >
                  Restore to draft
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function ComponentSampler({ tokens, scope }: { tokens: ThemeTokens; scope: ReturnType<typeof themeScopeProps> }) {
  return (
    <div {...scope} className="min-h-full bg-bg p-6 text-fg" style={{ ...scope.style, fontFamily: `'${tokens.fonts.body}', sans-serif` }}>
      <p className="eyebrow">Performance club</p>
      <h3 className="mt-3 text-3xl font-semibold tracking-tight" style={{ fontFamily: `'${tokens.fonts.heading}', sans-serif` }}>
        Train with <span className="text-gradient">intent</span>
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted">Elite coaching, precision equipment and a training floor engineered for results.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="btn btn-primary">Join now</span>
        <span className="btn btn-secondary">View plans</span>
        <span className="btn btn-ghost">Book a trial</span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Program</p>
          <p className="mt-1 font-semibold" style={{ fontFamily: `'${tokens.fonts.heading}', sans-serif` }}>
            Strength foundations
          </p>
          <p className="mt-1 text-sm text-muted">12 weeks · 3 sessions / week</p>
          <div className="mt-3 flex gap-1.5">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Beginner</span>
            <span className="rounded-full bg-fg/10 px-2 py-0.5 text-xs">Barbell</span>
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <label className="label" htmlFor="sampler-email">
            Email
          </label>
          <input id="sampler-email" className="input" placeholder="you@example.com" readOnly />
          <div className="flex gap-2 text-xs">
            <span className="text-success">● Confirmed</span>
            <span className="text-warning">● Pending</span>
            <span className="text-danger">● Failed</span>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-theme bg-brand-gradient p-5 text-on-primary">
        <p className="font-semibold">Gradient banner</p>
        <p className="text-sm opacity-80">Uses the brand gradient tokens.</p>
      </div>
    </div>
  );
}
