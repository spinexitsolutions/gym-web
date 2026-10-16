import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, EyeOff, ExternalLink, FilePlus2, Home, LayoutTemplate, Lock, MoreHorizontal, Navigation, PencilRuler, Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Skeleton, StatusBadge, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime } from '@/lib/format';
import { CharCount, FieldError, Hint, LabelRow } from './components/bits';
import type { PageDetail, PageListItem } from './components/types';
import { pageSlugError, SHADOWED_SLUGS, slugify } from './components/utils';

function SlugTitleFields({ title, setTitle, slug, setSlug, slugTouched, setSlugTouched, errors }: { title: string; setTitle: (v: string) => void; slug: string; setSlug: (v: string) => void; slugTouched: boolean; setSlugTouched: (v: boolean) => void; errors: Record<string, string> }) {
  const slugErr = errors.slug ?? (slug ? pageSlugError(slug) : undefined);
  return (
    <>
      <div>
        <LabelRow htmlFor="np-title" label="Title" required right={<CharCount value={title} max={120} />} />
        <input
          id="np-title"
          className="input"
          value={title}
          autoFocus
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          aria-invalid={errors.title ? true : undefined}
        />
        <FieldError>{errors.title}</FieldError>
      </div>
      <div>
        <LabelRow htmlFor="np-slug" label="URL" required />
        <div className="flex">
          <span className="inline-flex items-center rounded-l-theme-sm border border-r-0 border-line bg-fg/[0.04] px-3 text-sm text-muted">{window.location.host}/</span>
          <input
            id="np-slug"
            className="input rounded-l-none font-mono text-[0.85rem]"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
            }}
            aria-invalid={slugErr ? true : undefined}
          />
        </div>
        <FieldError>{slugErr}</FieldError>
        <Hint>{!slugErr && (SHADOWED_SLUGS.includes(slug) ? 'Warning: a built-in page already uses this URL.' : 'Generated from the title. Lowercase letters, numbers and hyphens.')}</Hint>
      </div>
    </>
  );
}

function CreatePageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState<'blank' | 'landing'>('landing');
  const [showInNav, setShowInNav] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: () => api.post<PageDetail>('/pages', { title: title.trim(), slug, template, showInNav }),
    onSuccess: (p) => {
      toast.success('Page created', 'It stays a draft until you publish it.');
      void qc.invalidateQueries({ queryKey: ['cms-pages'] });
      onClose();
      navigate(`/admin/website/pages/${p.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (err.status === 409 || /duplicate|exists/i.test(err.message)) fe.slug = 'A page with this URL already exists';
        setErrors(fe);
      }
      toast.error(err);
    },
  });
  const invalid = !title.trim() || Boolean(pageSlugError(slug));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New page"
      description="Pages are built from sections. Start blank or from a landing template."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={invalid} loading={m.isPending} onClick={() => m.mutate()}>
            Create & open builder
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) m.mutate();
        }}
      >
        <SlugTitleFields title={title} setTitle={setTitle} slug={slug} setSlug={setSlug} slugTouched={slugTouched} setSlugTouched={setSlugTouched} errors={errors} />
        <fieldset>
          <legend className="label">Template</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: 'landing', t: 'Landing', d: 'Hero + rich text + call to action.' },
                { v: 'blank', t: 'Blank', d: 'A single rich-text section.' },
              ] as const
            ).map((o) => (
              <label key={o.v} className={cn('cursor-pointer rounded-theme-sm border p-3 transition', template === o.v ? 'border-primary/60 bg-primary/[0.06]' : 'border-line hover:border-fg/25')}>
                <input type="radio" name="template" value={o.v} checked={template === o.v} onChange={() => setTemplate(o.v)} className="sr-only" />
                <span className="block text-sm font-medium">{o.t}</span>
                <span className="block text-xs text-muted">{o.d}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Checkbox label="Show in the main navigation (once published)" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function DuplicateModal({ page, onClose }: { page: PageListItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastId, setLastId] = useState<string | null>(null);
  if (page && page.id !== lastId) {
    setLastId(page.id);
    setTitle(`${page.title} (copy)`);
    setSlug(slugify(`${page.isHome ? 'home' : page.slug}-copy`));
    setSlugTouched(false);
    setErrors({});
  }
  const m = useMutation({
    mutationFn: () => api.post<PageDetail>(`/pages/${page!.id}/duplicate`, { title: title.trim(), slug }),
    onSuccess: (p) => {
      toast.success('Page duplicated', 'The copy is an unpublished draft.');
      void qc.invalidateQueries({ queryKey: ['cms-pages'] });
      onClose();
      navigate(`/admin/website/pages/${p.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(err);
    },
  });
  const invalid = !title.trim() || Boolean(pageSlugError(slug));
  return (
    <Modal
      open={Boolean(page)}
      onClose={onClose}
      title={`Duplicate “${page?.title ?? ''}”`}
      description="Copies the current draft, including all sections, into a new unpublished page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={invalid} loading={m.isPending} onClick={() => m.mutate()}>
            Duplicate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SlugTitleFields title={title} setTitle={setTitle} slug={slug} setSlug={setSlug} slugTouched={slugTouched} setSlugTouched={setSlugTouched} errors={errors} />
      </div>
    </Modal>
  );
}

function RowMenu({ page, onDuplicate, onUnpublish, onDelete }: { page: PageListItem; onDuplicate: () => void; onUnpublish: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const protectedPage = page.system || page.isHome;
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-fg/[0.06] disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-fg/[0.07] hover:text-fg" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${page.title}`} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-2xl" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <button role="menuitem" className={item} onClick={() => (setOpen(false), onDuplicate())}>
            <Copy className="h-4 w-4 text-muted" /> Duplicate
          </button>
          <button role="menuitem" className={item} disabled={page.isHome || page.status !== 'published'} onClick={() => (setOpen(false), onUnpublish())} title={page.isHome ? 'The home page cannot be unpublished' : undefined}>
            <EyeOff className="h-4 w-4 text-muted" /> Unpublish
          </button>
          <button role="menuitem" className={cn(item, 'text-danger')} disabled={protectedPage} onClick={() => (setOpen(false), onDelete())} title={protectedPage ? 'System pages cannot be deleted' : undefined}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function PagesListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['cms-pages'], queryFn: () => api.get<PageListItem[]>('/pages') });
  const [createOpen, setCreateOpen] = useState(false);
  const [dup, setDup] = useState<PageListItem | null>(null);
  const [unpub, setUnpub] = useState<PageListItem | null>(null);
  const [del, setDel] = useState<PageListItem | null>(null);

  const unpublishM = useMutation({
    mutationFn: (p: PageListItem) => api.post(`/pages/${p.id}/unpublish`),
    onSuccess: () => {
      toast.success('Page unpublished', 'Visitors now get a “not found” page at that URL.');
      setUnpub(null);
      void qc.invalidateQueries({ queryKey: ['cms-pages'] });
    },
    onError: (e) => toast.error(e),
  });
  const deleteM = useMutation({
    mutationFn: (p: PageListItem) => api.delete(`/pages/${p.id}`),
    onSuccess: () => {
      toast.success('Page deleted');
      setDel(null);
      void qc.invalidateQueries({ queryKey: ['cms-pages'] });
    },
    onError: (e) => toast.error(e),
  });

  const pages = q.data ?? [];
  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Pages & sections"
        description="Build pages from reusable sections. Edits are saved as drafts and go live only when you publish."
        actions={
          <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            New page
          </Button>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState icon={<LayoutTemplate className="h-5 w-5" />} title="No pages yet" description="Create your first page to start building the website." action={<Button onClick={() => setCreateOpen(true)}>New page</Button>} />
      ) : (
        <ul className="space-y-2.5" aria-label="Pages">
          {pages.map((p) => {
            const live = p.isHome ? '/' : `/${p.slug}`;
            return (
              <li key={p.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4 md:flex-nowrap">
                <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', p.isHome ? 'bg-primary/15 text-primary' : 'bg-fg/[0.06] text-fg/70')}>{p.isHome ? <Home className="h-5 w-5" /> : <LayoutTemplate className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/website/pages/${p.id}`} className="truncate font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    <StatusBadge status={p.status} />
                    {p.hasUnpublishedChanges && p.publishedVersion > 0 && <Badge tone="warning">Unpublished changes</Badge>}
                    {(p.system || p.isHome) && (
                      <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted" title="System page: cannot be deleted; URL is fixed">
                        <Lock className="h-3 w-3" /> System
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span className="font-mono">{live}</span>
                    <span>{p.sectionCount} section{p.sectionCount === 1 ? '' : 's'}</span>
                    <span>{p.publishedVersion > 0 ? `Live v${p.publishedVersion}${p.publishedAt ? ` · ${fmtDateTime(p.publishedAt)}` : ''}` : 'Never published'}</span>
                    {p.draftUpdatedAt && <span>Draft edited {relativeTime(p.draftUpdatedAt)}</span>}
                    {p.showInNav && !p.isHome && (
                      <span className="inline-flex items-center gap-1 text-fg/70">
                        <Navigation className="h-3 w-3" /> In nav (#{p.navOrder})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.status === 'published' && (
                    <a href={live} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" aria-label={`View ${p.title} live`}>
                      <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View live</span>
                    </a>
                  )}
                  <Link to={`/admin/website/pages/${p.id}`} className="btn btn-secondary btn-sm">
                    <PencilRuler className="h-3.5 w-3.5" /> Open builder
                  </Link>
                  <RowMenu page={p} onDuplicate={() => setDup(p)} onUnpublish={() => setUnpub(p)} onDelete={() => setDel(p)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePageModal key={String(createOpen)} open={createOpen} onClose={() => setCreateOpen(false)} />
      <DuplicateModal page={dup} onClose={() => setDup(null)} />
      <ConfirmDialog
        open={Boolean(unpub)}
        onClose={() => setUnpub(null)}
        loading={unpublishM.isPending}
        title={`Unpublish “${unpub?.title}”?`}
        description="The page is taken offline and removed from navigation. Its draft and version history are kept, so you can publish it again later."
        confirmLabel="Unpublish"
        onConfirm={() => unpub && unpublishM.mutate(unpub)}
      />
      <ConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        loading={deleteM.isPending}
        tone="danger"
        title={`Delete “${del?.title}”?`}
        description="This permanently deletes the page, its draft and all published versions. Links to it will show “not found”."
        confirmLabel="Delete permanently"
        onConfirm={() => del && deleteM.mutate(del)}
      />
    </div>
  );
}
