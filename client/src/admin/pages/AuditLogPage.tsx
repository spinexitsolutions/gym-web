import { Fragment, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, relativeTime } from '@/lib/format';
import { FilterBar, FilterSelect } from '../components/FilterBar';
import type { AuditEntry } from '../components/types';
import { cleanQuery, useDebounced } from '../components/utils';

const ENTITIES = ['User', 'Membership', 'Payment', 'MembershipPlan', 'Coupon', 'GymClass', 'Booking', 'WebsiteSettings', 'Report', 'Notification', 'MediaAsset', 'Page', 'ThemeConfiguration', 'BlogPost', 'Program', 'Review'] as const;

/** Pretty-prints arbitrary JSON as text. Rendered inside <pre> as a text node, so it can never inject HTML. */
function safeJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const tone = (action: string) => (/refund|cancel|suspend|delete|archive|deactivate/.test(action) ? 'danger' : /create|grant|payment|upload/.test(action) ? 'primary' : /export/.test(action) ? 'info' : 'neutral');

export default function AuditLogPage() {
  const [entity, setEntity] = useState<'' | (typeof ENTITIES)[number]>('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const da = useDebounced(action.trim(), 400);
  useEffect(() => setPage(1), [entity, da]);
  const filters = cleanQuery({ entity, action: da });
  const q = useQuery({ queryKey: ['admin', 'audit', filters, page], queryFn: () => api.getPaged<AuditEntry[]>('/settings/audit-logs', { ...filters, page, limit: 30 }), placeholderData: keepPreviousData });
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const rows = q.data?.data ?? [];
  return (
    <div>
      <PageHeader eyebrow="System" title="Audit log" description="Every sensitive staff action — payments, refunds, membership changes, exports and settings — with who did it and when." />
      <FilterBar>
        <FilterSelect label="Entity" value={entity} onChange={setEntity} options={ENTITIES.map((e) => ({ value: e, label: e }))} />
        <Input wrapClassName="lg:w-64" label="Action (exact)" placeholder="e.g. membership.extend" value={action} onChange={(e) => setAction(e.target.value)} />
        {(entity || action) && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setEntity('');
              setAction('');
            }}
          >
            Clear
          </Button>
        )}
      </FilterBar>
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No audit entries" description={entity || action ? 'Nothing matches these filters.' : 'Staff actions will be recorded here.'} />
      ) : (
        <div className="scrollbar-thin overflow-x-auto rounded-theme border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="bg-fg/[0.03] text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-8 px-3 py-3" aria-label="Expand" />
                <th className="px-3 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">Actor</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {rows.map((a) => {
                const isOpen = open.has(a._id);
                const expandable = a.changes !== undefined && a.changes !== null;
                return (
                  <Fragment key={a._id}>
                    <tr className={cn(isOpen && 'bg-fg/[0.02]')}>
                      <td className="px-3 py-3 align-top">
                        <button type="button" onClick={() => toggle(a._id)} aria-expanded={isOpen} aria-label={isOpen ? 'Hide details' : 'Show details'} className="rounded p-0.5 text-muted hover:bg-fg/5 hover:text-fg">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums" title={fmtDateTime(a.createdAt)}>
                        {fmtDateTime(a.createdAt)}
                        <span className="block text-xs text-muted">{relativeTime(a.createdAt)}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {a.actorName ?? 'System'}
                        {a.actorRole && <span className="block text-xs text-muted">{a.actorRole}</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge tone={tone(a.action)}>{a.action}</Badge>
                        <span className="mt-1 block text-xs text-muted">{a.entity}</span>
                      </td>
                      <td className="max-w-md px-3 py-3 align-top text-fg/90">
                        <span className="line-clamp-2 break-words">{a.summary || (expandable ? 'Field changes recorded' : '—')}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-fg/[0.02]">
                        <td />
                        <td colSpan={4} className="px-3 pb-4">
                          <dl className="mb-2 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
                            <div>
                              <dt className="inline">Entity ID: </dt>
                              <dd className="inline font-mono text-fg">{a.entityId ?? '—'}</dd>
                            </div>
                            <div>
                              <dt className="inline">IP: </dt>
                              <dd className="inline font-mono text-fg">{a.ip ?? '—'}</dd>
                            </div>
                            <div>
                              <dt className="inline">Actor ID: </dt>
                              <dd className="inline font-mono text-fg">{a.actor ?? '—'}</dd>
                            </div>
                          </dl>
                          {a.summary && <p className="mb-2 whitespace-pre-wrap break-words text-sm">{a.summary}</p>}
                          {expandable ? (
                            <pre className="scrollbar-thin max-h-80 overflow-auto rounded-theme-sm border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-fg/90">{safeJson(a.changes)}</pre>
                          ) : (
                            <p className="text-xs text-muted">No field-level changes recorded.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {q.data?.meta && <Pagination page={q.data.meta.page} pages={q.data.meta.pages} total={q.data.meta.total} onPage={setPage} />}
    </div>
  );
}
