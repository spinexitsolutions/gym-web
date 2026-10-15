import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, History, Layers, PanelRight, Plus, Rocket, Save, Settings2, SlidersHorizontal } from 'lucide-react';
import { createSection, newSectionId, SECTION_META, sectionPropsSchemas, type DraftSection, type SectionType, type Seo } from '@apex/shared';
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Modal, PageLoader, StatusBadge, useToast } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { AddSectionModal } from './components/AddSectionModal';
import { SaveIndicator, Segmented, type SaveState } from './components/bits';
import type { ErrorMap } from './components/FieldControls';
import { PageSettingsPanel, type PageSettingsValue } from './components/PageSettingsPanel';
import { PreviewFrame } from './components/PreviewFrame';
import { SectionEditor } from './components/SectionEditor';
import { SectionList } from './components/SectionList';
import type { PageDetail, PageVersion, SectionError } from './components/types';
import { useUnsavedChangesWarning } from './components/utils';
import { VersionsModal } from './components/VersionsModal';

interface DraftState extends PageSettingsValue {
  sections: DraftSection[];
}

const AUTOSAVE_MS = 1500;

const toDraft = (p: PageDetail): DraftState => ({
  title: p.title,
  slug: p.slug,
  seo: Object.assign({ title: '', description: '', image: '', noIndex: false }, p.seo ?? {}) as Seo,
  featuredImage: p.featuredImage ?? '',
  showInNav: p.showInNav,
  navOrder: p.navOrder,
  sections: p.sections ?? [],
});

/** Client-side validation with the same zod schemas the server uses on publish. */
function validateClient(sections: DraftSection[]): Record<string, ErrorMap> {
  const out: Record<string, ErrorMap> = {};
  for (const s of sections) {
    const schema = sectionPropsSchemas[s.type];
    if (!schema) continue;
    const r = schema.safeParse(s.props ?? {});
    if (!r.success) {
      const m: ErrorMap = {};
      for (const i of r.error.issues) {
        const k = i.path.join('.');
        if (!(k in m)) m[k] = i.message;
      }
      out[s.id] = m;
    }
  }
  return out;
}

/** Server issues use paths like `props.ctas.0.href`; strip the `props.` prefix for field mapping. */
function serverErrorMap(errors: SectionError[] | undefined, sections: DraftSection[]): Record<string, ErrorMap> {
  const out: Record<string, ErrorMap> = {};
  for (const e of errors ?? []) {
    const id = e.id ?? sections[e.index]?.id;
    if (!id) continue;
    const m: ErrorMap = out[id] ?? {};
    for (const i of e.issues) m[i.path.replace(/^props\.?/, '')] = i.message;
    out[id] = m;
  }
  return out;
}

type MobilePane = 'sections' | 'editor' | 'preview';

export default function PageBuilderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const pageQ = useQuery({ queryKey: ['cms-page', id], queryFn: () => api.get<PageDetail>(`/pages/${id}`), refetchOnWindowFocus: false, staleTime: Infinity });

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [meta, setMeta] = useState<PageDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'section' | 'settings'>('section');
  const [pane, setPane] = useState<MobilePane>('editor');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string>('');
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, ErrorMap>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishFailure, setPublishFailure] = useState<{ message: string; errors: SectionError[] } | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const draftRef = useRef<DraftState | null>(null);
  draftRef.current = draft;
  const savedSnap = useRef<string>('');
  const inflight = useRef<Promise<boolean> | null>(null);

  const load = useCallback((p: PageDetail) => {
    const d = toDraft(p);
    savedSnap.current = JSON.stringify(d);
    setDraft(d);
    setMeta(p);
    setServerErrors(serverErrorMap(p.validation?.errors, d.sections));
    setSaveState('saved');
    setSelectedId((cur) => (cur && d.sections.some((s) => s.id === cur) ? cur : (d.sections[0]?.id ?? null)));
  }, []);

  useEffect(() => {
    if (pageQ.data && !draftRef.current) load(pageQ.data);
  }, [pageQ.data, load]);

  const snap = useMemo(() => (draft ? JSON.stringify(draft) : ''), [draft]);
  const dirty = Boolean(draft) && snap !== savedSnap.current;

  /* --------------------------------- Saving --------------------------------- */

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    const d = draftRef.current;
    if (!d) return false;
    const s = JSON.stringify(d);
    if (s === savedSnap.current) return true;
    const original = JSON.parse(savedSnap.current) as DraftState;
    setSaveState('saving');
    const body: Record<string, unknown> = { title: d.title, seo: d.seo, featuredImage: d.featuredImage, sections: d.sections, showInNav: d.showInNav, navOrder: d.navOrder };
    if (d.slug !== original.slug) body.slug = d.slug;
    const run = (async () => {
      try {
        const res = await api.put<PageDetail>(`/pages/${id}/draft`, body);
        savedSnap.current = s;
        setMeta(res);
        setSettingsErrors({});
        setSaveError('');
        setServerErrors(serverErrorMap(res.validation?.errors, d.sections));
        setSaveState(JSON.stringify(draftRef.current) === s ? 'saved' : 'unsaved');
        qc.setQueryData(['cms-page', id], res);
        void qc.invalidateQueries({ queryKey: ['cms-pages'] });
        return true;
      } catch (err) {
        setSaveState('error');
        setSaveError(errorMessage(err));
        if (err instanceof ApiError) setSettingsErrors(err.fieldErrors);
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [id, qc]);

  // Debounced autosave after each change.
  useEffect(() => {
    if (!draft || !dirty) return;
    setSaveState((st) => (st === 'saving' ? st : 'unsaved'));
    const t = setTimeout(() => void saveNow(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  useUnsavedChangesWarning(dirty || saveState === 'saving');

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow().then((ok) => ok && toast.success('Draft saved'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow, toast]);

  /* ------------------------------ Section edits ----------------------------- */

  const updateSections = (fn: (s: DraftSection[]) => DraftSection[]) => setDraft((d) => (d ? { ...d, sections: fn(d.sections) } : d));
  const clearServer = (sid: string) =>
    setServerErrors((m) => {
      if (!(sid in m)) return m;
      const { [sid]: _drop, ...rest } = m;
      return rest;
    });
  const updateSection = (next: DraftSection) => {
    clearServer(next.id);
    updateSections((list) => list.map((s) => (s.id === next.id ? next : s)));
  };
  const addSection = (type: SectionType) => {
    const s = createSection(type);
    updateSections((list) => {
      const idx = selectedId ? list.findIndex((x) => x.id === selectedId) : -1;
      const at = idx >= 0 ? idx + 1 : list.length;
      return [...list.slice(0, at), s, ...list.slice(at)];
    });
    setSelectedId(s.id);
    setTab('section');
    setPane('editor');
    toast.success(`${SECTION_META[type].label} added`);
  };
  const duplicate = (sid: string) => {
    const src = draft?.sections.find((s) => s.id === sid);
    if (!src) return;
    const copy: DraftSection = { ...(JSON.parse(JSON.stringify(src)) as DraftSection), id: newSectionId() };
    if (typeof copy.props.anchorId === 'string' && copy.props.anchorId) copy.props.anchorId = '';
    updateSections((list) => {
      const i = list.findIndex((s) => s.id === sid);
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
    setSelectedId(copy.id);
  };
  const remove = (sid: string) => {
    const list = draft?.sections ?? [];
    const i = list.findIndex((s) => s.id === sid);
    updateSections((l) => l.filter((s) => s.id !== sid));
    clearServer(sid);
    if (selectedId === sid) setSelectedId(list[i + 1]?.id ?? list[i - 1]?.id ?? null);
  };
  const reorder = (from: number, to: number) =>
    updateSections((list) => {
      const next = list.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  /* ------------------------------- Validation ------------------------------- */

  const clientErrors = useMemo(() => validateClient(draft?.sections ?? []), [draft?.sections]);
  const errorsFor = useCallback((sid: string): ErrorMap => ({ ...(serverErrors[sid] ?? {}), ...(clientErrors[sid] ?? {}) }), [serverErrors, clientErrors]);
  const errorCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of draft?.sections ?? []) {
      const n = Object.keys(errorsFor(s.id)).length;
      if (n) out[s.id] = n;
    }
    return out;
  }, [draft?.sections, errorsFor]);
  const invalidCount = Object.keys(errorCounts).length;

  /* -------------------------------- Publishing ------------------------------- */

  const publish = async () => {
    setPublishing(true);
    setPublishFailure(null);
    try {
      const saved = await saveNow();
      if (!saved) {
        toast.error('Couldn’t save the draft', 'Fix the save error, then publish again. The live page has not changed.');
        return;
      }
      const res = await api.post<{ version: number; publishedAt: string }>(`/pages/${id}/publish`, { note: publishNote.trim() || undefined });
      toast.success(`Published version ${res.version}`, 'The live site updates within a minute for open visitors.');
      setPublishOpen(false);
      setPublishNote('');
      const fresh = await api.get<PageDetail>(`/pages/${id}`);
      setMeta(fresh);
      qc.setQueryData(['cms-page', id], fresh);
      void qc.invalidateQueries({ queryKey: ['cms-pages'] });
      void qc.invalidateQueries({ queryKey: ['cms-page-versions', id] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.details)) {
        const errors = err.details as SectionError[];
        setPublishFailure({ message: err.message, errors });
        setServerErrors(serverErrorMap(errors, draftRef.current?.sections ?? []));
        const first = errors[0];
        const firstId = first?.id ?? draftRef.current?.sections[first?.index ?? -1]?.id;
        if (firstId) {
          setSelectedId(firstId);
          setTab('section');
        }
      } else toast.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const restore = async (v: PageVersion) => {
    setRestoring(true);
    try {
      const res = await api.post<PageDetail>(`/pages/${id}/versions/${v._id}/restore`);
      const full = await api.get<PageDetail>(`/pages/${id}`);
      load({ ...res, ...full });
      qc.setQueryData(['cms-page', id], full);
      setVersionsOpen(false);
      toast.success(`Version ${v.version} restored into the draft`, 'Review it, then publish to make it live.');
    } catch (err) {
      toast.error(err);
    } finally {
      setRestoring(false);
    }
  };

  /* --------------------------------- Render --------------------------------- */

  const previewPayload = useMemo(() => ({ sections: draft?.sections ?? [] }), [draft?.sections]);

  if (pageQ.isError) return <ErrorState error={pageQ.error} onRetry={() => pageQ.refetch()} title="Couldn’t load this page" />;
  if (!draft || !meta) return <PageLoader label="Loading page builder" />;

  const selected = draft.sections.find((s) => s.id === selectedId) ?? null;
  const liveHref = meta.isHome ? '/' : `/${meta.slug}`;
  const hasUnpublished = meta.hasUnpublishedChanges || dirty;
  const settingsValue: PageSettingsValue = { title: draft.title, slug: draft.slug, seo: draft.seo, featuredImage: draft.featuredImage, showInNav: draft.showInNav, navOrder: draft.navOrder };
  const original = JSON.parse(savedSnap.current) as DraftState;

  const sectionsPane = (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Sections <span className="ml-1 text-fg/60">{draft.sections.length}</span>
        </p>
        <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
          Add
        </Button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {draft.sections.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <Layers className="mx-auto mb-3 h-6 w-6 text-muted" />
            <p className="text-sm font-medium">This page is empty</p>
            <p className="mt-1 text-xs text-muted">Add your first section to start building.</p>
            <Button size="sm" className="mt-4" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
              Add section
            </Button>
          </div>
        ) : (
          <SectionList
            sections={draft.sections}
            selectedId={selectedId}
            errorCounts={errorCounts}
            onSelect={(sid) => {
              setSelectedId(sid);
              setTab('section');
              setPane('editor');
            }}
            onReorder={reorder}
            onToggle={(sid) => updateSections((l) => l.map((s) => (s.id === sid ? { ...s, enabled: !s.enabled } : s)))}
            onDuplicate={duplicate}
            onDelete={setDeleteId}
          />
        )}
      </div>
      {draft.sections.length > 0 && (
        <div className="border-t border-line/70 p-2">
          <button type="button" onClick={() => setAddOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-xs font-medium text-muted transition hover:border-primary/50 hover:text-primary">
            <Plus className="h-3.5 w-3.5" /> Add section {selected ? 'below selected' : ''}
          </button>
        </div>
      )}
    </div>
  );

  const editorPane = (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2">
        <Segmented
          label="Editor panel"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'section', label: <><SlidersHorizontal className="h-3.5 w-3.5" /> Section</> },
            { value: 'settings', label: <><Settings2 className="h-3.5 w-3.5" /> Page settings</> },
          ]}
        />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
        {tab === 'settings' ? (
          <PageSettingsPanel value={settingsValue} onChange={(v) => setDraft((d) => (d ? { ...d, ...v } : d))} system={meta.system} isHome={meta.isHome} errors={settingsErrors} originalSlug={original.slug} />
        ) : selected ? (
          <SectionEditor key={selected.id} section={selected} onChange={updateSection} errors={errorsFor(selected.id)} />
        ) : (
          <div className="py-16 text-center text-sm text-muted">Select a section on the left to edit it.</div>
        )}
      </div>
    </div>
  );

  const previewPane = <PreviewFrame src={`/preview/${id}`} payload={previewPayload} className="h-full" toolbarLeft={<span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Live preview</span>} />;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-4rem)] flex-col md:-mx-8 md:-my-8">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/70 bg-surface/40 px-4 py-2.5 md:px-6">
        <Link to="/admin/website/pages" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-fg/[0.06] hover:text-fg" aria-label="Back to pages">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-base font-semibold md:text-lg">{draft.title || 'Untitled page'}</h1>
            <StatusBadge status={meta.status} />
            {hasUnpublished && meta.publishedVersion > 0 && <Badge tone="warning">Unpublished changes</Badge>}
          </div>
          <p className="truncate text-xs text-muted">
            {meta.isHome ? '/' : `/${meta.slug}`} ·{' '}
            {meta.publishedVersion > 0 ? (
              <>
                Live: v{meta.publishedVersion}
                {meta.publishedAt && ` · published ${fmtDateTime(meta.publishedAt)}`}
              </>
            ) : (
              'Never published'
            )}
          </p>
        </div>
        <div className="flex-1" />
        <SaveIndicator state={saveState} message={saveError} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<History className="h-4 w-4" />} onClick={() => setVersionsOpen(true)}>
            <span className="hidden sm:inline">Versions</span>
          </Button>
          {meta.status === 'published' && (
            <a href={liveHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View live</span>
            </a>
          )}
          <Button size="sm" variant="secondary" icon={<Save className="h-4 w-4" />} loading={saveState === 'saving'} disabled={!dirty && saveState !== 'error'} onClick={() => void saveNow().then((ok) => ok && toast.success('Draft saved'))}>
            Save
          </Button>
          <Button size="sm" icon={<Rocket className="h-4 w-4" />} onClick={() => setPublishOpen(true)}>
            Publish
          </Button>
        </div>
        {saveState === 'error' && (
          <p role="alert" className="basis-full text-xs text-danger">
            Draft not saved: {saveError}
          </p>
        )}
      </header>

      {/* Mobile / tablet pane switcher */}
      <div className="flex justify-center border-b border-line/70 px-3 py-2 xl:hidden">
        <Segmented
          label="Builder view"
          size="sm"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'sections', label: <><Layers className="h-3.5 w-3.5" /> Sections</> },
            { value: 'editor', label: <><SlidersHorizontal className="h-3.5 w-3.5" /> Edit</> },
            { value: 'preview', label: <><PanelRight className="h-3.5 w-3.5" /> Preview</> },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[272px_minmax(360px,420px)_minmax(0,1fr)]">
        <div className={cn('min-h-0 border-line/70 xl:flex xl:flex-col xl:border-r', pane === 'sections' ? 'flex flex-col' : 'hidden')}>{sectionsPane}</div>
        <div className={cn('min-h-0 border-line/70 bg-surface/30 xl:flex xl:flex-col xl:border-r', pane === 'editor' ? 'flex flex-col' : 'hidden')}>{editorPane}</div>
        <div className={cn('min-h-0 xl:flex xl:flex-col', pane === 'preview' ? 'flex flex-col' : 'hidden')}>{previewPane}</div>
      </div>

      <AddSectionModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={addSection} afterLabel={selected ? SECTION_META[selected.type].label : undefined} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        tone="danger"
        title="Delete this section?"
        description={deleteId ? `“${SECTION_META[draft.sections.find((s) => s.id === deleteId)?.type ?? 'hero'].label}” will be removed from the draft. The live page is unaffected until you publish; you can also restore an earlier version.` : undefined}
        confirmLabel="Delete section"
        onConfirm={() => {
          if (deleteId) remove(deleteId);
          setDeleteId(null);
        }}
      />

      <Modal
        open={publishOpen}
        onClose={() => {
          setPublishOpen(false);
          setPublishFailure(null);
        }}
        title="Publish page"
        description={`Publishing creates version ${meta.publishedVersion + 1} and replaces what visitors see at ${liveHref}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button loading={publishing} icon={<Rocket className="h-4 w-4" />} onClick={() => void publish()}>
              {publishFailure ? 'Try again' : 'Publish now'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {publishFailure ? (
            <Alert tone="danger" title="Publishing was blocked — the live page has not changed.">
              <p className="mb-2">{publishFailure.message}</p>
              <ul className="space-y-1.5">
                {publishFailure.errors.map((e) => {
                  const s = draft.sections.find((x) => x.id === e.id) ?? draft.sections[e.index];
                  return (
                    <li key={`${e.index}-${e.id}`}>
                      <button
                        type="button"
                        className="text-left font-medium text-fg underline-offset-2 hover:underline"
                        onClick={() => {
                          if (s) setSelectedId(s.id);
                          setTab('section');
                          setPane('editor');
                          setPublishOpen(false);
                        }}
                      >
                        #{e.index + 1} {s ? SECTION_META[s.type].label : e.type}
                      </button>
                      <ul className="ml-4 list-disc text-xs">
                        {e.issues.map((i, k) => (
                          <li key={k}>
                            <code>{i.path.replace(/^props\./, '')}</code>: {i.message}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </Alert>
          ) : invalidCount > 0 ? (
            <Alert tone="warning" title={`${invalidCount} section${invalidCount > 1 ? 's have' : ' has'} validation issues`}>
              The server will refuse to publish until they are fixed; the live page will stay as it is.
            </Alert>
          ) : (
            <p className="text-sm text-fg/80">
              {dirty ? 'Your latest edits will be saved first. ' : ''}All {draft.sections.length} sections pass validation ({draft.sections.filter((s) => !s.enabled).length} hidden).
            </p>
          )}
          <div>
            <label htmlFor="publish-note" className="label">
              Note (optional)
            </label>
            <input id="publish-note" className="input" maxLength={200} value={publishNote} onChange={(e) => setPublishNote(e.target.value)} placeholder="e.g. Updated hero for the summer campaign" />
          </div>
        </div>
      </Modal>

      <VersionsModal open={versionsOpen} onClose={() => setVersionsOpen(false)} pageId={id} currentVersion={meta.publishedVersion} onRestore={(v) => void restore(v)} restoring={restoring} hasUnsaved={dirty} />

    </div>
  );
}
