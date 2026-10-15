import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FolderPlus, ImageIcon, ImageOff, Search, UploadCloud, X } from 'lucide-react';
import { mediaUrl } from '@apex/shared';
import { Button, EmptyState, ErrorState, Modal, Pagination, Skeleton, useToast } from '@/components/ui';
import { ApiError, api, apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { FieldError, Hint, LabelRow, Segmented } from './bits';
import type { MediaAsset, UploadResult } from './types';
import { formatBytes, thumbUrl } from './utils';

export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.gif,image/jpeg,image/png,image/webp,image/avif,image/gif';
const ALLOWED_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FOLDER_RE = /^[a-z0-9-]{1,40}$/;

export interface MediaListResponse {
  items: MediaAsset[];
  meta: { page: number; pages: number; total: number; folders: string[] };
}

export function useMediaList(params: { kind?: 'image' | 'model'; folder?: string; q?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: ['media', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MediaListResponse> => {
      const res = await apiRequest<MediaAsset[]>('/media', { query: { kind: params.kind, folder: params.folder, q: params.q, page: params.page ?? 1, limit: params.limit ?? 24 } });
      const m = res.meta;
      return { items: res.data, meta: { page: m?.page ?? 1, pages: m?.pages ?? 1, total: m?.total ?? res.data.length, folders: (m?.folders as string[] | undefined) ?? [] } };
    },
  });
}

/** Client-side pre-checks. The server re-validates everything (magic bytes, dimensions). */
export function precheckImage(f: File): string | undefined {
  if (!ALLOWED_EXT.test(f.name)) return 'Unsupported type — use JPG, PNG, WebP, AVIF or GIF';
  if (f.size > MAX_IMAGE_BYTES) return `Too large (${formatBytes(f.size)}). Max 8 MB`;
  return undefined;
}

/** Uploads images in batches of 10 and merges per-file errors from the client and server. */
export function useImageUpload() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const upload = useCallback(
    async (files: File[], folder: string): Promise<UploadResult> => {
      const errors: UploadResult['errors'] = [];
      const ok: File[] = [];
      for (const f of files) {
        const e = precheckImage(f);
        if (e) errors.push({ file: f.name, message: e });
        else ok.push(f);
      }
      const uploaded: MediaAsset[] = [];
      setBusy(true);
      try {
        for (let i = 0; i < ok.length; i += 10) {
          const form = new FormData();
          ok.slice(i, i + 10).forEach((f) => form.append('files', f));
          form.append('folder', folder || 'general');
          try {
            const res = await api.upload<UploadResult>('/media/images', form);
            uploaded.push(...res.uploaded);
            errors.push(...res.errors);
          } catch (err) {
            if (err instanceof ApiError && Array.isArray(err.details) && err.details.length && 'file' in (err.details[0] as object)) errors.push(...(err.details as UploadResult['errors']));
            else ok.slice(i, i + 10).forEach((f) => errors.push({ file: f.name, message: err instanceof Error ? err.message : 'Upload failed' }));
          }
        }
      } finally {
        setBusy(false);
        if (uploaded.length) await qc.invalidateQueries({ queryKey: ['media'] });
      }
      return { uploaded, errors };
    },
    [qc],
  );
  return { upload, busy };
}

/** Folder select with "new folder" entry. */
export function FolderSelect({ value, onChange, folders, label = 'Folder' }: { value: string; onChange: (v: string) => void; folders: string[]; label?: string }) {
  const id = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const all = Array.from(new Set(['general', ...folders, value].filter(Boolean))).sort();
  const valid = FOLDER_RE.test(name);
  if (creating)
    return (
      <div>
        <LabelRow htmlFor={id} label="New folder" />
        <div className="flex gap-2">
          <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. hero-images" autoFocus aria-invalid={name && !valid ? true : undefined} />
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              onChange(name);
              setCreating(false);
              setName('');
            }}
          >
            Use
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
        {name && !valid && <FieldError>Lowercase letters, numbers and hyphens (max 40)</FieldError>}
      </div>
    );
  return (
    <div>
      <LabelRow htmlFor={id} label={label} />
      <div className="flex gap-2">
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {all.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)} icon={<FolderPlus className="h-4 w-4" />} aria-label="New folder">
          New
        </Button>
      </div>
    </div>
  );
}

/** Drag & drop + file input upload area with folder selector and per-file results. */
export function UploadDropzone({ folders, defaultFolder = 'general', onUploaded, compact }: { folders: string[]; defaultFolder?: string; onUploaded?: (assets: MediaAsset[]) => void; compact?: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState(defaultFolder);
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<UploadResult['errors']>([]);
  const { upload, busy } = useImageUpload();
  useEffect(() => setFolder(defaultFolder), [defaultFolder]);

  const handle = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const res = await upload(files, folder);
    setErrors(res.errors);
    if (res.uploaded.length) {
      toast.success(`Uploaded ${res.uploaded.length} image${res.uploaded.length > 1 ? 's' : ''}`, res.errors.length ? `${res.errors.length} file(s) failed` : undefined);
      onUploaded?.(res.uploaded);
    } else if (res.errors.length) toast.error('Nothing was uploaded', res.errors[0].message);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void handle(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <FolderSelect value={folder} onChange={setFolder} folders={folders} label="Upload to folder" />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-theme border-2 border-dashed px-6 text-center transition',
          compact ? 'py-6' : 'py-10',
          drag ? 'border-primary bg-primary/5' : 'border-line hover:border-fg/25',
        )}
      >
        <UploadCloud className={cn('mb-3 h-8 w-8', drag ? 'text-primary' : 'text-muted')} />
        <p className="text-sm font-medium">Drag & drop images here</p>
        <p className="mt-1 text-xs text-muted">JPG, PNG, WebP, AVIF or GIF · up to 8 MB each · max 8000px · SVG not accepted</p>
        <Button className="mt-4" size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : 'Choose files'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          aria-label="Choose image files"
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-theme-sm border border-danger/30 bg-danger/5 p-3 text-xs" aria-label="Upload errors">
          {errors.map((er, i) => (
            <li key={i} className="flex gap-2">
              <span className="max-w-[45%] truncate font-medium text-fg">{er.file}</span>
              <span className="text-danger">{er.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MediaThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  return <img src={thumbUrl(asset, 300)} alt={asset.alt || ''} loading="lazy" className={cn('h-full w-full object-cover', className)} />;
}

export interface PickedImage {
  url: string;
  alt: string;
  asset?: MediaAsset;
}

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (images: PickedImage[]) => void;
  multiple?: boolean;
  title?: string;
}

/** Modal to pick image(s) from the media library, upload new ones, or paste a URL. */
export function MediaPicker({ open, onClose, onSelect, multiple, title }: MediaPickerProps) {
  const [tab, setTab] = useState<'library' | 'upload' | 'url'>('library');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaAsset[]>([]);
  const [url, setUrl] = useState('');
  const [urlAlt, setUrlAlt] = useState('');
  const list = useMediaList({ kind: 'image', folder: folder || undefined, q: debouncedQ || undefined, page, limit: 24 }, open);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) {
      setSelected([]);
      setUrl('');
      setUrlAlt('');
      setTab('library');
    }
  }, [open]);

  const toggle = (a: MediaAsset) => {
    if (!multiple) {
      setSelected([a]);
      return;
    }
    setSelected((s) => (s.some((x) => x._id === a._id) ? s.filter((x) => x._id !== a._id) : [...s, a]));
  };
  const confirm = () => {
    onSelect(selected.map((a) => ({ url: a.url, alt: a.alt ?? '', asset: a })));
    onClose();
  };
  const urlCheck = url ? mediaUrl.safeParse(url) : null;
  const urlError = urlCheck && !urlCheck.success ? urlCheck.error.issues[0]?.message : undefined;

  const folders = list.data?.meta.folders ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title ?? (multiple ? 'Choose images' : 'Choose an image')}
      description="Pick from the media library, upload new files, or paste an image URL."
      footer={
        tab === 'url' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!url || Boolean(urlError)}
              onClick={() => {
                onSelect([{ url: url.trim(), alt: urlAlt.trim() }]);
                onClose();
              }}
            >
              Use this URL
            </Button>
          </>
        ) : tab === 'library' ? (
          <>
            <span className="mr-auto self-center text-xs text-muted">{selected.length ? `${selected.length} selected` : multiple ? 'Select one or more images' : 'Select an image'}</span>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!selected.length} onClick={confirm}>
              {multiple ? `Add ${selected.length || ''} image${selected.length === 1 ? '' : 's'}` : 'Use image'}
            </Button>
          </>
        ) : undefined
      }
    >
      <Segmented
        label="Image source"
        value={tab}
        onChange={setTab}
        className="mb-4"
        options={[
          { value: 'library', label: 'Library' },
          { value: 'upload', label: 'Upload' },
          { value: 'url', label: 'Paste URL' },
        ]}
      />
      {tab === 'library' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
            </div>
            <select
              className="input w-auto min-w-[10rem]"
              value={folder}
              aria-label="Filter by folder"
              onChange={(e) => {
                setFolder(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : !list.data?.items.length ? (
            <EmptyState
              icon={<ImageIcon className="h-5 w-5" />}
              title={debouncedQ || folder ? 'No matching images' : 'Your library is empty'}
              description="Upload images to use them across the website."
              action={
                <Button size="sm" onClick={() => setTab('upload')}>
                  Upload images
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6" aria-label="Media library">
                {list.data.items.map((a) => {
                  const sel = selected.some((x) => x._id === a._id);
                  return (
                    <li key={a._id}>
                      <button
                        type="button"
                        onClick={() => toggle(a)}
                        onDoubleClick={() => {
                          if (!multiple) {
                            onSelect([{ url: a.url, alt: a.alt ?? '', asset: a }]);
                            onClose();
                          }
                        }}
                        aria-pressed={sel}
                        aria-label={`${a.name}${a.width ? `, ${a.width}×${a.height}` : ''}`}
                        className={cn('group relative block aspect-square w-full overflow-hidden rounded-theme-sm bg-fg/5 ring-2 ring-offset-2 ring-offset-surface transition', sel ? 'ring-primary' : 'ring-transparent hover:ring-fg/20')}
                      >
                        <MediaThumb asset={a} />
                        {sel && (
                          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-left text-[0.68rem] text-white opacity-0 transition group-hover:opacity-100">{a.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />
            </>
          )}
        </div>
      )}
      {tab === 'upload' && (
        <UploadDropzone
          folders={folders}
          onUploaded={(assets) => {
            setSelected(multiple ? assets : assets.slice(0, 1));
            setFolder('');
            setQ('');
            setPage(1);
            setTab('library');
          }}
        />
      )}
      {tab === 'url' && (
        <div className="space-y-4">
          <div>
            <LabelRow htmlFor="mp-url" label="Image URL" />
            <input id="mp-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or /uploads/…" aria-invalid={urlError ? true : undefined} />
            <FieldError>{urlError}</FieldError>
            <Hint>{!urlError && 'Must be an https:// URL or a path on this site. Prefer uploading so images are optimised and resized.'}</Hint>
          </div>
          <div>
            <LabelRow htmlFor="mp-alt" label="Alt text (optional)" />
            <input id="mp-alt" className="input" value={urlAlt} onChange={(e) => setUrlAlt(e.target.value)} maxLength={160} />
          </div>
          {url && !urlError && (
            <div className="overflow-hidden rounded-theme-sm border border-line bg-fg/5">
              <img src={url} alt="" className="mx-auto max-h-64 object-contain" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Image field: thumbnail + choose/replace/remove + paste URL. Value is a URL string. */
export function ImageField({ label, value, onChange, error, hint, onAlt, aspect = 'video' }: { label: ReactNode; value: string; onChange: (url: string) => void; error?: string; hint?: ReactNode; onAlt?: (alt: string) => void; aspect?: 'video' | 'square' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  return (
    <div>
      <LabelRow htmlFor={id} label={label} />
      <div className={cn('flex gap-3 rounded-theme-sm border bg-bg/40 p-2.5', error ? 'border-danger/70' : 'border-line')}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn('relative shrink-0 overflow-hidden rounded-lg bg-fg/[0.06] ring-1 ring-line transition hover:ring-primary/60', aspect === 'square' ? 'h-20 w-20' : 'h-20 w-32')}
          aria-label={value ? 'Replace image' : 'Choose image'}
        >
          {value && !broken ? (
            <img src={value} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted">{broken ? <ImageOff className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <input id={id} className="input !py-1.5 text-xs" value={value} placeholder="No image — choose or paste a URL" onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<ImageIcon className="h-3.5 w-3.5" />}>
              {value ? 'Replace' : 'Choose'}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange('')} icon={<X className="h-3.5 w-3.5" />}>
                Remove
              </Button>
            )}
            {broken && <span className="self-center text-xs text-warning">Image failed to load</span>}
          </div>
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <Hint>{!error && hint}</Hint>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={([img]) => {
          if (!img) return;
          onChange(img.url);
          if (onAlt && img.alt) onAlt(img.alt);
        }}
      />
    </div>
  );
}

