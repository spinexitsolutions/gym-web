import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * columns: [{ key, header, render?(row), sortKey?, className?, hideOnMobile? }]
 * sort: '-field' | 'field'; onSort(newSort)
 */
export function DataTable({ columns, rows, loading, error, onRetry, sort, onSort, empty, rowKey = (r) => r._id || r.id, onRowClick, caption }) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  const sortIcon = (c) => {
    if (!c.sortKey) return null;
    if (sort === c.sortKey) return <ArrowUp className="h-3 w-3" aria-hidden />;
    if (sort === `-${c.sortKey}`) return <ArrowDown className="h-3 w-3" aria-hidden />;
    return <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />;
  };
  const ariaSort = (c) => (sort === c.sortKey ? 'ascending' : sort === `-${c.sortKey}` ? 'descending' : 'none');
  return (
    <div className="overflow-x-auto rounded-brand border border-line/10 bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line/10 text-left text-xs uppercase tracking-wider text-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={c.sortKey ? ariaSort(c) : undefined} className={cn('px-4 py-3 font-medium', c.className, c.hideOnMobile && 'hidden md:table-cell')}>
                {c.sortKey && onSort ? (
                  <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => onSort(sort === c.sortKey ? `-${c.sortKey}` : c.sortKey)}>
                    {c.header}{sortIcon(c)}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? Array.from({ length: 6 }, (_, i) => (
            <tr key={i} className="border-b border-line/5">{columns.map((c) => <td key={c.key} className={cn('px-4 py-4', c.hideOnMobile && 'hidden md:table-cell')}><div className="skeleton h-4 w-3/4" /></td>)}</tr>
          )) : rows?.length ? rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn('border-b border-line/5 last:border-0', onRowClick && 'cursor-pointer hover:bg-ink/[0.03]')}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.className, c.hideOnMobile && 'hidden md:table-cell')}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="p-6"><EmptyState className="border-0" {...(empty || {})} /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return meta?.total ? <p className="mt-3 text-xs text-muted">{meta.total} record{meta.total === 1 ? '' : 's'}</p> : null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{meta.total} records · page {meta.page} of {meta.pages}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="subtle" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button size="sm" variant="subtle" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
