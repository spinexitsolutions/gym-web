import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquareQuote, Reply, Star, X } from 'lucide-react';
import { Button, EmptyState, ErrorState, Modal, PageHeader, Pagination, Skeleton, StatusBadge, Tabs, useToast } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { CharCount, LabelRow } from './components/bits';

interface Review {
  _id: string;
  displayName?: string;
  rating: number;
  title?: string;
  body?: string;
  response?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
type Status = 'pending' | 'approved' | 'rejected' | 'all';

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex text-warning" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? 'fill-current' : 'opacity-25'}`} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ review: Review; status: Review['status'] } | null>(null);
  const [response, setResponse] = useState('');
  const list = useQuery({
    queryKey: ['cms-reviews', status, page],
    placeholderData: keepPreviousData,
    queryFn: () => apiRequest<Review[]>('/cms/admin/reviews', { query: { status: status === 'all' ? undefined : status, page, limit: 20 } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: string; status: Review['status']; response?: string }) => api.patch<Review>(`/cms/admin/reviews/${v.id}`, { status: v.status, response: v.response }),
    onSuccess: (r) => {
      toast.success(r.status === 'approved' ? 'Review approved' : r.status === 'rejected' ? 'Review rejected' : 'Review updated', r.status === 'approved' ? 'It is now visible on the website.' : undefined);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['cms-reviews'] });
    },
    onError: (e) => toast.error(e),
  });
  const open = (review: Review, s: Review['status']) => {
    setResponse(review.response ?? '');
    setEditing({ review, status: s });
  };
  const items = list.data?.data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Website" title="Member reviews" description="Reviews submitted by members. Only approved reviews are shown publicly. You can add a public response from the club." />
      <Tabs
        className="mb-5 w-fit"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        tabs={[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<MessageSquareQuote className="h-5 w-5" />} title={status === 'pending' ? 'No reviews waiting' : 'No reviews here'} description={status === 'pending' ? 'New member reviews appear here for moderation.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r._id} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars n={r.rating} />
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted">
                      {r.displayName || 'Member'} · {fmtDateTime(r.createdAt)}
                    </span>
                  </div>
                  {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 whitespace-pre-line text-sm text-fg/80">{r.body}</p>}
                  {r.response && (
                    <div className="mt-3 rounded-theme-sm border-l-2 border-primary/60 bg-fg/[0.03] px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted">Club response</p>
                      <p className="text-fg/85">{r.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.status !== 'approved' && (
                    <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} loading={m.isPending && m.variables?.id === r._id} onClick={() => m.mutate({ id: r._id, status: 'approved', response: r.response })}>
                      Approve
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => m.mutate({ id: r._id, status: 'rejected', response: r.response })}>
                      Reject
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={<Reply className="h-3.5 w-3.5" />} onClick={() => open(r, r.status === 'pending' ? 'approved' : r.status)}>
                    {r.response ? 'Edit response' : 'Respond'}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Public response"
        description="Shown under the review on the website when it is approved. Be courteous; don’t include personal details."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={m.isPending} onClick={() => editing && m.mutate({ id: editing.review._id, status: editing.status, response: response.trim() })}>
              {editing?.status === 'approved' && editing.review.status !== 'approved' ? 'Approve with response' : 'Save response'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="rounded-theme-sm bg-fg/[0.03] p-3 text-sm">
              <Stars n={editing.review.rating} />
              {editing.review.title && <p className="mt-1 font-medium">{editing.review.title}</p>}
              <p className="mt-1 text-fg/75">{editing.review.body}</p>
            </div>
            <div>
              <LabelRow htmlFor="rv-resp" label="Response" right={<CharCount value={response} max={1000} />} />
              <textarea id="rv-resp" rows={4} className="input resize-y" maxLength={1000} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Thanks for training with us…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
