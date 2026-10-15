import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, relativeTime } from '@/lib/format';
import type { PageVersion } from './types';

export function VersionsModal({ open, onClose, pageId, currentVersion, onRestore, restoring, hasUnsaved }: { open: boolean; onClose: () => void; pageId: string; currentVersion: number; onRestore: (v: PageVersion) => void; restoring?: boolean; hasUnsaved?: boolean }) {
  const q = useQuery({ queryKey: ['cms-page-versions', pageId], queryFn: () => api.get<PageVersion[]>(`/pages/${pageId}/versions`), enabled: open });
  const [confirm, setConfirm] = useState<PageVersion | null>(null);
  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" title="Version history" description="Every publish creates a version. Restoring loads it into the draft — review it, then publish to make it live.">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !q.data?.length ? (
          <EmptyState icon={<History className="h-5 w-5" />} title="No versions yet" description="Publish this page to create the first version." />
        ) : (
          <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-line">
            {q.data.map((v) => (
              <li key={v._id} className="relative flex items-center gap-3 rounded-theme-sm border border-line bg-bg/40 p-3">
                <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-display text-sm font-semibold">v{v.version}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {v.title}
                    {v.version === currentVersion && <Badge tone="success">Live</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {fmtDateTime(v.createdAt)} · {relativeTime(v.createdAt)}
                    {v.publishedBy?.name && ` · ${v.publishedBy.name}`}
                  </p>
                  {v.note && <p className="mt-0.5 truncate text-xs text-fg/75">“{v.note}”</p>}
                </div>
                <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setConfirm(v)}>
                  Restore
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={restoring}
        title={`Restore version ${confirm?.version}?`}
        description={`This replaces the current draft with version ${confirm?.version}. The live page does not change until you publish.`}
        confirmLabel="Restore into draft"
        onConfirm={() => {
          if (confirm) onRestore(confirm);
          setConfirm(null);
        }}
      >
        {hasUnsaved && <p className="text-sm text-warning">You have unsaved edits; they will be discarded.</p>}
      </ConfirmDialog>
    </>
  );
}
