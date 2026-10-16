import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Mail } from 'lucide-react';
import { Alert, Badge, Button, DataTable, PageHeader, Pagination, useToast, type Column } from '@/components/ui';
import { apiRequest, download } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

interface Subscriber {
  _id: string;
  email: string;
  status: 'subscribed' | 'unsubscribed';
  source?: string;
  consentAt?: string;
  createdAt: string;
}

export default function SubscribersPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const list = useQuery({ queryKey: ['cms-subscribers', page], placeholderData: keepPreviousData, queryFn: () => apiRequest<Subscriber[]>('/cms/admin/subscribers', { query: { page, limit: 25 } }) });
  const columns: Column<Subscriber>[] = [
    { key: 'email', header: 'Email', cell: (s) => <span className="font-medium">{s.email}</span> },
    { key: 'status', header: 'Status', cell: (s) => <Badge tone={s.status === 'subscribed' ? 'success' : 'neutral'}>{s.status}</Badge> },
    { key: 'source', header: 'Source', hideOnMobile: true, cell: (s) => <span className="text-muted">{s.source || '—'}</span> },
    { key: 'consent', header: 'Consent given', hideOnMobile: true, cell: (s) => <span className="text-muted">{s.consentAt ? fmtDateTime(s.consentAt) : '—'}</span> },
  ];
  const exportCsv = async () => {
    setExporting(true);
    try {
      await download('/cms/admin/subscribers', { format: 'csv' }, 'subscribers.csv');
      toast.success('Export downloaded', 'Only active subscribers are included.');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Website"
        title="Newsletter subscribers"
        description="People who opted in to emails from the website footer or newsletter sections."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={() => void exportCsv()}>
            Export CSV
          </Button>
        }
      />
      <Alert tone="info" className="mb-5">
        Each subscriber gave explicit consent (timestamp recorded) and every email includes an unsubscribe link. Exports are logged in the audit log — store them securely and only use them for the newsletter.
      </Alert>
      <DataTable
        caption="Newsletter subscribers"
        columns={columns}
        rows={list.data?.data}
        rowKey={(s) => s._id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        empty={{ title: 'No subscribers yet', description: 'Add a Newsletter section to a page or enable the footer signup in Theme → Header & footer.' }}
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      {list.data && list.data.data.length > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
          <Mail className="h-3.5 w-3.5" /> {list.data.meta?.total ?? list.data.data.length} total (including unsubscribed)
        </p>
      )}
    </div>
  );
}
