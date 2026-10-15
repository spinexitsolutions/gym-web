import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { EmptyState, ErrorState, Skeleton } from './States';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
  onRowClick?: (row: T) => void;
  caption?: string;
}

/** Responsive table: horizontal scroll on small screens, loading/empty/error states built in. */
export function DataTable<T>({ columns, rows, rowKey, isLoading, error, onRetry, empty, onRowClick, caption }: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!isLoading && rows && rows.length === 0) return <EmptyState title={empty?.title ?? 'Nothing here yet'} description={empty?.description} action={empty?.action} />;
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-theme border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-fg/[0.03] text-xs uppercase tracking-wider text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-4 py-3 font-medium', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3.5', c.hideOnMobile && 'hidden md:table-cell')}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn('transition', onRowClick && 'cursor-pointer hover:bg-fg/[0.03] focus:bg-fg/[0.04]')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total?: number; onPage: (p: number) => void }) {
  if (pages <= 1) return total !== undefined ? <p className="mt-3 text-xs text-muted">{total} total</p> : null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">
        Page {page} of {pages}
        {total !== undefined && ` · ${total} total`}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft className="h-4 w-4" />}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
