import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CreditCard, FileDown, RotateCcw } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Button, DataTable, PageHeader, Pagination, StatusBadge, useToast, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, money, titleCase } from '@/lib/format';
import { PaymentsStatusBanner, PersonCell, RowActions } from '../components/Bits';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { ExportButton, FilterBar, FilterSelect, SearchInput } from '../components/FilterBar';
import { OfflinePaymentModal } from '../components/OfflinePaymentModal';
import { PaymentDetailModal, RefundModal, canRefund, downloadReceipt } from '../components/PaymentModals';
import type { AdminPayment } from '../components/types';
import { cleanQuery, endOfDayIso, startOfDayIso, useDebounced } from '../components/utils';

const STATUSES = ['captured', 'pending', 'created', 'failed', 'refunded', 'partially_refunded', 'expired'] as const;
const PROVIDERS = ['razorpay', 'sandbox', 'offline'] as const;

export default function PaymentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | (typeof STATUSES)[number]>((params.get('status') as 'captured') ?? '');
  const [provider, setProvider] = useState<'' | (typeof PROVIDERS)[number]>('');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminPayment | null>(null);
  const [refund, setRefund] = useState<AdminPayment | null>(null);
  const [offline, setOffline] = useState(false);
  const dq = useDebounced(q.trim(), 350);
  useEffect(() => setPage(1), [dq, status, provider, range.from, range.to]);

  const filters = cleanQuery({ q: dq, status, provider, from: startOfDayIso(range.from), to: endOfDayIso(range.to) });
  const list = useQuery({
    queryKey: ['admin', 'payments', 'list', filters, page],
    queryFn: () => api.getPaged<AdminPayment[]>('/payments', { ...filters, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const hasFilters = Boolean(dq || status || provider || range.from || range.to);

  const columns: Column<AdminPayment>[] = [
    { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(p.capturedAt ?? p.createdAt)}</span> },
    { key: 'member', header: 'Member', cell: (p) => <PersonCell name={p.user?.name ?? '—'} sub={p.user?.email} /> },
    { key: 'plan', header: 'Plan', hideOnMobile: true, cell: (p) => <PersonCell name={p.planName} sub={`${titleCase(p.mode)}${p.couponCode ? ` · ${p.couponCode}` : ''}`} /> },
    { key: 'via', header: 'Via', hideOnMobile: true, cell: (p) => <span className="text-muted">{titleCase(p.provider)}{p.method ? ` · ${titleCase(p.method)}` : ''}</span> },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      cell: (p) => (
        <span className="block text-right tabular-nums">
          <span className="font-medium">{money(p.amountMinor)}</span>
          {p.refund && <span className="block text-xs text-danger">−{money(p.refund.amountMinor)}</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'receipt', header: 'Receipt', hideOnMobile: true, cell: (p) => <code className="text-xs text-muted">{p.receiptNumber ?? '—'}</code> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (p) => (
        <RowActions>
          {p.receiptNumber && p.capturedAt && <Button size="sm" variant="ghost" aria-label="Download receipt" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadReceipt(p, toast.error)} />}
          {can('payments:write') && canRefund(p) && <Button size="sm" variant="ghost" className="text-danger" aria-label="Refund" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setRefund(p)} />}
        </RowActions>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Payments"
        description="Online checkouts and front-desk payments, with receipts and refunds."
        actions={
          <>
            <ExportButton path="/payments" query={filters} filename="payments.csv" />
            {can('payments:write') && (
              <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => setOffline(true)}>
                Record offline payment
              </Button>
            )}
          </>
        }
      />
      <PaymentsStatusBanner className="mb-5" />
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Member, receipt, order or payment ID" label="Search payments" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterSelect label="Provider" value={provider} onChange={setProvider} options={PROVIDERS.map((s) => ({ value: s, label: titleCase(s) }))} />
        <DateRangePicker value={range} onChange={setRange} label="Created" />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setQ('');
              setStatus('');
              setProvider('');
              setRange({ from: '', to: '' });
            }}
          >
            Clear
          </Button>
        )}
      </FilterBar>
      <DataTable
        caption="Payments"
        columns={columns}
        rows={list.data?.data}
        rowKey={(p) => p.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        onRowClick={setDetail}
        empty={
          hasFilters
            ? { title: 'No payments match these filters', description: 'Search matches exact receipt, order and payment IDs, or member name/email.' }
            : {
                title: 'No payments yet',
                description: 'Online checkouts and front-desk payments will appear here.',
                action: can('payments:write') ? (
                  <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => setOffline(true)}>
                    Record offline payment
                  </Button>
                ) : undefined,
              }
        }
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pages={list.data.meta.pages} total={list.data.meta.total} onPage={setPage} />}
      <PaymentDetailModal
        payment={detail}
        onClose={() => setDetail(null)}
        onRefund={(p) => {
          setDetail(null);
          setRefund(p);
        }}
      />
      <RefundModal payment={refund} onClose={() => setRefund(null)} />
      <OfflinePaymentModal open={offline} onClose={() => setOffline(false)} />
    </div>
  );
}
