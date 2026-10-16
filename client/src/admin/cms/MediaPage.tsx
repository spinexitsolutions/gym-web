import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Folder, ImageIcon, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { CharCount, LabelRow } from './components/bits';
import { FolderSelect, MediaThumb, UploadDropzone, useMediaList } from './components/MediaPicker';
import type { MediaAsset } from './components/types';
import { formatBytes } from './components/utils';

function DetailPanel({ asset, folders, onClose, onDeleted }: { asset: MediaAsset; folders: string[]; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(asset.name);
  const [alt, setAlt] = useState(asset.alt ?? '');
  const [folder, setFolder] = useState(asset.folder);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setName(asset.name);
    setAlt(asset.alt ?? '');
    setFolder(asset.folder);
  }, [asset]);
  const dirty = name !== asset.name || alt !== (asset.alt ?? '') || folder !== asset.folder;

  const save = useMutation({
    mutationFn: () => api.patch<MediaAsset>(`/media/${asset._id}`, { name: name.trim(), alt: alt.trim(), folder }),
    onSuccess: () => {
      toast.success('Image details saved');
      void qc.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (e) => toast.error(e),
  });
  const del = useMutation({
    mutationFn: () => api.delete<{ deleted: boolean; note?: string }>(`/media/${asset._id}`),
    onSuccess: (r) => {
      toast.success('Image deleted', r.note);
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: ['media'] });
      onDeleted();
    },
    onError: (e) => toast.error(e),
  });
  const absolute = asset.url.startsWith('http') ? asset.url : `${window.location.origin}${asset.url}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy — select the URL and copy it manually');
    }
  };

  return (
    <aside className="card flex flex-col overflow-hidden" aria-label="Image details">
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
        <h2 className="text-sm font-semibold">Image details</h2>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-fg/[0.07] hover:text-fg" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid place-items-center bg-[repeating-conic-gradient(rgb(var(--c-text)/0.05)_0%_25%,transparent_0%_50%)] [background-size:16px_16px]">
        <img src={asset.url} alt={asset.alt || ''} className="max-h-64 w-auto object-contain" />
      </div>
      <div className="space-y-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="text-muted">Dimensions</dt>
          <dd className="text-right tabular-nums">{asset.width && asset.height ? `${asset.width} × ${asset.height}px` : '—'}</dd>
          <dt className="text-muted">File size</dt>
          <dd className="text-right tabular-nums">{formatBytes(asset.size)}</dd>
          <dt className="text-muted">Type</dt>
          <dd className="text-right">{asset.mime.replace('image/', '').toUpperCase()}</dd>
          <dt className="text-muted">Responsive sizes</dt>
          <dd className="text-right">{asset.variants?.length ? asset.variants.map((v) => `${v.width}w`).join(', ') : 'Original only'}</dd>
          <dt className="text-muted">Uploaded</dt>
          <dd className="text-right">{fmtDateTime(asset.createdAt)}</dd>
        </dl>
        <div>
          <LabelRow htmlFor="m-url" label="URL" />
          <div className="flex gap-1.5">
            <input id="m-url" readOnly value={absolute} className="input !py-1.5 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" variant="secondary" onClick={() => void copy()} icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} aria-label="Copy URL">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div>
          <LabelRow htmlFor="m-name" label="Name" right={<CharCount value={name} max={160} />} />
          <input id="m-name" className="input" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <LabelRow htmlFor="m-alt" label="Alt text" right={<CharCount value={alt} max={200} />} />
          <textarea id="m-alt" rows={2} className="input resize-y" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for screen readers and SEO" />
        </div>
        <FolderSelect value={folder} onChange={setFolder} folders={folders} label="Folder" />
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" disabled={!dirty || !name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
          <Button variant="ghost" className="text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        loading={del.isPending}
        title="Delete this image?"
        description="The file and all its resized versions are permanently removed. Pages, posts or content items that use this image will lose it (they show their fallback) until you choose a new one."
        confirmLabel="Delete image"
        onConfirm={() => del.mutate()}
      />
    </aside>
  );
}

export default function MediaPage() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useMediaList({ kind: 'image', folder: folder || undefined, q: debouncedQ || undefined, page, limit: 30 });
  const folders = list.data?.meta.folders ?? [];
  const items = list.data?.items ?? [];
  const selected = items.find((a) => a._id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Media library"
        description="Images used across pages, content and blog posts. Uploads are checked, stripped of metadata and resized into responsive versions automatically."
        actions={
          <Button icon={<UploadCloud className="h-4 w-4" />} variant={showUpload ? 'secondary' : 'primary'} onClick={() => setShowUpload((s) => !s)}>
            {showUpload ? 'Hide upload' : 'Upload images'}
          </Button>
        }
      />

      {showUpload && (
        <div className="card mb-6 p-5">
          <UploadDropzone folders={folders} defaultFolder={folder || 'general'} onUploaded={(assets) => assets[0] && setSelectedId(assets[0]._id)} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search images by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
        </div>
        <div className="scrollbar-thin flex gap-1 overflow-x-auto" role="group" aria-label="Filter by folder">
          {['', ...folders].map((f) => (
            <button
              key={f || 'all'}
              type="button"
              onClick={() => {
                setFolder(f);
                setPage(1);
              }}
              aria-pressed={folder === f}
              className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition', folder === f ? 'border-primary/50 bg-primary/10 text-primary' : 'border-line text-muted hover:text-fg')}
            >
              <Folder className="h-3.5 w-3.5" />
              {f || 'All folders'}
            </button>
          ))}
        </div>
        {list.data && <span className="ml-auto text-xs text-muted">{list.data.meta.total} image{list.data.meta.total === 1 ? '' : 's'}</span>}
      </div>

      <div className={cn('grid gap-6', selected && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ImageIcon className="h-5 w-5" />}
              title={debouncedQ || folder ? 'No images match' : 'No images yet'}
              description={debouncedQ || folder ? 'Try another search or folder.' : 'Upload photos of your facility, coaches and members (with consent) to use on the website.'}
              action={
                <Button size="sm" onClick={() => setShowUpload(true)}>
                  Upload images
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-label="Images">
                {items.map((a) => (
                  <li key={a._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a._id === selectedId ? null : a._id)}
                      aria-pressed={a._id === selectedId}
                      className={cn('group block w-full overflow-hidden rounded-theme-sm border bg-surface text-left transition', a._id === selectedId ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-fg/30')}
                    >
                      <span className="block aspect-square overflow-hidden bg-fg/5">
                        <MediaThumb asset={a} className="transition duration-300 group-hover:scale-[1.03]" />
                      </span>
                      <span className="block px-2.5 py-2">
                        <span className="block truncate text-xs font-medium">{a.name}</span>
                        <span className="block truncate text-[0.68rem] text-muted">
                          {a.width}×{a.height} · {formatBytes(a.size)} · {a.folder}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={list.data!.meta.page} pages={list.data!.meta.pages} total={list.data!.meta.total} onPage={setPage} />
            </>
          )}
        </div>
        {selected && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <DetailPanel asset={selected} folders={folders} onClose={() => setSelectedId(null)} onDeleted={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
