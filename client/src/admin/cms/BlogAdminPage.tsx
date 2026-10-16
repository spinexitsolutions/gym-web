import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, DataTable, PageHeader, Pagination, StatusBadge, Tabs, useToast, type Column } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { fmtDate, relativeTime } from '@/lib/format';

export interface AdminPost {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  category?: string;
  tags: string[];
  authorName?: string;
  status: 'draft' | 'published';
  publishedAt?: string | null;
  readingMinutes?: number;
  updatedAt: string;
}

export default function BlogAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [del, setDel] = useState<AdminPost | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useQuery({
    queryKey: ['cms-blog', status, dq, page],
    placeholderData: keepPreviousData,
    queryFn: () => apiRequest<AdminPost[]>('/blog/admin', { query: { status: status === 'all' ? undefined : status, q: dq || undefined, page, limit: 20 } }),
  });
  const delM = useMutation({
    mutationFn: (p: AdminPost) => api.delete(`/blog/admin/${p._id}`),
    onSuccess: () => {
      toast.success('Article deleted');
      setDel(null);
      void qc.invalidateQueries({ queryKey: ['cms-blog'] });
    },
    onError: (e) => toast.error(e),
  });

  const scheduled = (p: AdminPost) => p.status === 'published' && p.publishedAt && new Date(p.publishedAt).getTime() > Date.now();
  const columns: Column<AdminPost>[] = [
    {
      key: 'title',
      header: 'Article',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-fg/[0.06]">{p.coverImage && <img src={p.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
          <div className="min-w-0">
            <p className="truncate font-medium">{p.title}</p>
            <p className="truncate font-mono text-xs text-muted">/blog/{p.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => (scheduled(p) ? <StatusBadge status="upcoming" /> : <StatusBadge status={p.status} />) },
    { key: 'category', header: 'Category', hideOnMobile: true, cell: (p) => <span className="text-muted">{p.category || '—'}</span> },
    { key: 'date', header: 'Published', hideOnMobile: true, cell: (p) => <span className="text-muted">{p.publishedAt ? fmtDate(p.publishedAt) : '—'}</span> },
    { key: 'updated', header: 'Updated', hideOnMobile: true, cell: (p) => <span className="text-muted">{relativeTime(p.updatedAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {p.status === 'published' && !scheduled(p) && (
            <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" aria-label={`View ${p.title}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Link to={`/admin/website/blog/${p._id}`} className="btn btn-ghost btn-sm" aria-label={`Edit ${p.title}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <Button size="sm" variant="ghost" className="text-danger" aria-label={`Delete ${p.title}`} onClick={() => setDel(p)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Blog"
        description="Articles for the journal. Published posts appear on /blog and in Blog sections."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admin/website/blog/new')}>
            New article
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Drafts' },
          ]}
        />
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" aria-label="Search articles" />
        </div>
      </div>
      <DataTable
        caption="Blog articles"
        columns={columns}
        rows={list.data?.data}
        rowKey={(p) => p._id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        onRowClick={(p) => navigate(`/admin/website/blog/${p._id}`)}
        empty={{ title: dq || status !== 'all' ? 'No matching articles' : 'No articles yet', description: 'Share training tips, member stories and club news.', action: <Button icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/admin/website/blog/new')}>Write an article</Button> }}
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} tone="danger" loading={delM.isPending} title={`Delete “${del?.title}”?`} description="The article is removed from the website immediately. This cannot be undone." confirmLabel="Delete article" onConfirm={() => del && delM.mutate(del)} />
    </div>
  );
}
