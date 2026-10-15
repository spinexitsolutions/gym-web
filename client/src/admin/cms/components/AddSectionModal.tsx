import { useMemo, useState } from 'react';
import { Database, Search } from 'lucide-react';
import { SECTION_META, SECTION_TYPES, type SectionType } from '@apex/shared';
import { Modal } from '@/components/ui';
import { SECTION_ICONS } from './sectionIcons';

/** Grid of all section types; inserting is handled by the caller. */
export function AddSectionModal({ open, onClose, onAdd, afterLabel }: { open: boolean; onClose: () => void; onAdd: (type: SectionType) => void; afterLabel?: string }) {
  const [q, setQ] = useState('');
  const types = useMemo(() => {
    const term = q.trim().toLowerCase();
    return SECTION_TYPES.filter((t) => !term || `${SECTION_META[t].label} ${SECTION_META[t].description} ${SECTION_META[t].dataSource ?? ''}`.toLowerCase().includes(term));
  }, [q]);
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Add a section" description={afterLabel ? `Inserted after “${afterLabel}”.` : 'Inserted at the end of the page.'}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections (e.g. pricing, gallery, form)" aria-label="Search section types" />
      </div>
      {types.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No section types match “{q}”.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => {
            const m = SECTION_META[t];
            const Icon = SECTION_ICONS[t];
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(t);
                    onClose();
                    setQ('');
                  }}
                  className="group flex h-full w-full flex-col gap-2 rounded-theme-sm border border-line bg-bg/40 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.04]"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-fg/[0.06] text-fg/80 transition group-hover:bg-primary/15 group-hover:text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="font-medium">{m.label}</span>
                  </span>
                  <span className="text-xs leading-relaxed text-muted">{m.description}</span>
                  {m.dataSource && (
                    <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[0.65rem] font-medium text-sky-300">
                      <Database className="h-3 w-3" /> Data: {m.dataSource}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
