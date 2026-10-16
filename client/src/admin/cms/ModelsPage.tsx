import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, CheckCircle2, FileBox, ShieldCheck, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { BUILTIN_MODELS } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, Skeleton, StatusBadge, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { CharCount, FieldError, LabelRow } from './components/bits';
import { useMediaList } from './components/MediaPicker';
import type { MediaAsset } from './components/types';
import { formatBytes } from './components/utils';

const MAX_MODEL_BYTES = 15 * 1024 * 1024;

const REQUIREMENTS = [
  'A single binary .glb file (glTF 2.0) — not .gltf with separate files',
  'Textures embedded in the .glb',
  'No Draco or meshopt compression (not supported by the loader)',
  'Up to 15 MB and 500,000 triangles; keep meshes/materials modest for mobile',
  'Real-world scale in metres, centred near the origin, Y-up',
  'You must own the model or have a licence that permits use on this website',
];

function UploadModelCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [rights, setRights] = useState(false);
  const [error, setError] = useState('');
  const pick = (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (!/\.glb$/i.test(f.name)) return setError('Only binary .glb files are accepted.');
    if (f.size > MAX_MODEL_BYTES) return setError(`File is ${formatBytes(f.size)} — the maximum is 15 MB.`);
    setFile(f);
    if (!name) setName(f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').slice(0, 80));
  };
  const m = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('name', name.trim());
      return api.upload<MediaAsset>('/media/models', form);
    },
    onSuccess: (a) => {
      toast.success('Model uploaded — pending review', `${a.model?.triangles?.toLocaleString() ?? '?'} triangles, ${a.model?.meshes ?? '?'} meshes.`);
      setFile(null);
      setName('');
      setRights(false);
      void qc.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Upload failed'),
  });
  return (
    <section className="card p-5">
      <h2 className="font-display text-base font-semibold">Upload a model</h2>
      <p className="mt-0.5 text-xs text-muted">The server inspects the file and rejects anything that breaks the rules below.</p>
      <ul className="mt-4 space-y-1.5 text-xs text-fg/80">
        {REQUIREMENTS.map((r) => (
          <li key={r} className="flex gap-2">
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
            {r}
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-4">
        <div className="flex items-center gap-3 rounded-theme-sm border border-dashed border-line p-3">
          <FileBox className="h-8 w-8 shrink-0 text-muted" />
          <div className="min-w-0 flex-1 text-sm">{file ? <><p className="truncate font-medium">{file.name}</p><p className="text-xs text-muted">{formatBytes(file.size)}</p></> : <p className="text-muted">No file selected</p>}</div>
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
            {file ? 'Change' : 'Choose .glb'}
          </Button>
          <input ref={input} type="file" accept=".glb,model/gltf-binary" className="sr-only" aria-label="Choose .glb file" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
        </div>
        <div>
          <LabelRow htmlFor="model-name" label="Display name" right={<CharCount value={name} max={160} />} />
          <input id="model-name" className="input" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rogue power rack" />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-fg/90">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-primary))]" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          <span>I confirm we own this model or hold a licence that allows publishing it on our website.</span>
        </label>
        <FieldError>{error}</FieldError>
        <Button className="w-full" icon={<UploadCloud className="h-4 w-4" />} disabled={!file || !rights || !name.trim()} loading={m.isPending} onClick={() => m.mutate()}>
          Upload for review
        </Button>
      </div>
    </section>
  );
}

export default function ModelsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { site } = useSite();
  const [page, setPage] = useState(1);
  const list = useMediaList({ kind: 'model', page, limit: 20 });
  const [review, setReview] = useState<{ asset: MediaAsset; status: 'approved' | 'rejected' } | null>(null);
  const [notes, setNotes] = useState('');
  const [del, setDel] = useState<MediaAsset | null>(null);

  const reviewM = useMutation({
    mutationFn: () => api.post<MediaAsset>(`/media/models/${review!.asset._id}/review`, { status: review!.status, notes: notes.trim() || undefined }),
    onSuccess: (a) => {
      toast.success(a.model?.status === 'approved' ? 'Model approved' : 'Model rejected', a.model?.status === 'approved' ? 'It can now be selected in 3D scene settings.' : undefined);
      setReview(null);
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['site'] });
    },
    onError: (e) => toast.error(e),
  });
  const delM = useMutation({
    mutationFn: (a: MediaAsset) => api.delete(`/media/${a._id}`),
    onSuccess: () => {
      toast.success('Model deleted');
      setDel(null);
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['site'] });
    },
    onError: (e) => toast.error(e),
  });

  const builtins = site?.models.filter((m) => m.kind === 'procedural') ?? BUILTIN_MODELS.map((m) => ({ id: m.id, name: m.name, kind: m.kind, url: null }));
  const items = list.data?.items ?? [];

  return (
    <div>
      <PageHeader eyebrow="Website" title="3D models" description="Built-in procedural models are always available. Uploaded .glb models must be reviewed and approved before they can be used in hero and equipment scenes." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Uploaded models</h2>
            {list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : list.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<Box className="h-5 w-5" />} title="No uploaded models" description="Upload a .glb to showcase your actual equipment. Until then, the built-in models below are used." />
            ) : (
              <>
                <ul className="space-y-2.5">
                  {items.map((a) => {
                    const status = a.model?.status ?? 'pending';
                    return (
                      <li key={a._id} className="card flex flex-wrap items-center gap-4 p-4">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-fg/[0.06]">
                          <Box className="h-5 w-5 text-fg/70" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {a.name} <StatusBadge status={status} />
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatBytes(a.size)} · {a.model?.triangles?.toLocaleString() ?? '?'} triangles · {a.model?.meshes ?? '?'} meshes · {a.model?.materials ?? '?'} materials · uploaded {fmtDateTime(a.createdAt)}
                          </p>
                          {a.model?.notes && <p className="mt-1 text-xs text-fg/75">Review note: “{a.model.notes}”</p>}
                          {status === 'approved' && <p className="mt-1 font-mono text-[0.7rem] text-muted">Scene id: asset:{a._id}</p>}
                        </div>
                        <div className="flex gap-1.5">
                          {status !== 'approved' && (
                            <Button size="sm" variant="secondary" icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setReview({ asset: a, status: 'approved' })}>
                              Approve
                            </Button>
                          )}
                          {status !== 'rejected' && (
                            <Button size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setReview({ asset: a, status: 'rejected' })}>
                              Reject
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-danger" aria-label={`Delete ${a.name}`} onClick={() => setDel(a)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pagination page={list.data!.meta.page} pages={list.data!.meta.pages} total={list.data!.meta.total} onPage={setPage} />
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Built-in models</h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {builtins.map((m) => (
                <li key={m.id} className="card flex items-center gap-3 p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/12 text-primary">
                    <Box className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="font-mono text-[0.7rem] text-muted">{m.id}</p>
                  </div>
                  <Badge className="ml-auto">Procedural</Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="space-y-4">
          <UploadModelCard />
          <Alert tone="info" title="How models reach the website">
            Approved models appear in the <strong>Model</strong> dropdown of the 3D scene settings (Hero and 3D equipment sections in the page builder). Pending and rejected models are never offered to visitors (the public site only lists approved models). If you reject or delete a model a page already uses, pick another model for that section and republish.
          </Alert>
        </div>
      </div>

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={review?.status === 'approved' ? `Approve “${review?.asset.name}”?` : `Reject “${review?.asset.name}”?`}
        description={review?.status === 'approved' ? 'Check that it looks right, performs well and that you have the rights to publish it.' : 'Rejected models cannot be used on the website.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <Button variant={review?.status === 'rejected' ? 'danger' : 'primary'} loading={reviewM.isPending} onClick={() => reviewM.mutate()}>
              {review?.status === 'approved' ? 'Approve model' : 'Reject model'}
            </Button>
          </>
        }
      >
        <LabelRow htmlFor="review-notes" label="Notes (optional)" right={<CharCount value={notes} max={500} />} />
        <textarea id="review-notes" rows={3} className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={review?.status === 'rejected' ? 'Why it was rejected (e.g. too heavy, wrong scale, licence unclear)' : 'e.g. Licence: CC-BY, attribution in footer'} />
      </Modal>
      <ConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        tone="danger"
        loading={delM.isPending}
        title={`Delete “${del?.name}”?`}
        description="The file is permanently removed. Any published scene that uses it will no longer be able to load it — choose another model in those sections."
        confirmLabel="Delete model"
        onConfirm={() => del && delM.mutate(del)}
      />
    </div>
  );
}
