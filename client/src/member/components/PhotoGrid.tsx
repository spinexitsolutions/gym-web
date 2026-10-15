import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Badge, Button } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { ProgressPhoto } from './types';

/** Private progress photo grid with a simple lightbox. `url` is an authenticated endpoint. */
export function PhotoGrid({ photos, onDelete }: { photos: ProgressPhoto[]; onDelete?: (p: ProgressPhoto) => void }) {
  const [view, setView] = useState<ProgressPhoto | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <motion.li key={p.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="group relative overflow-hidden rounded-2xl border border-line bg-fg/[0.03]">
            <button type="button" onClick={() => setView(p)} className="block aspect-[3/4] w-full" aria-label={`View ${p.pose} photo from ${fmtDate(p.takenAt)}`}>
              <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8 text-white">
              <p className="text-xs font-medium">{fmtDate(p.takenAt)}</p>
              <p className="text-[0.7rem] capitalize opacity-80">{p.pose}</p>
            </div>
            {onDelete && (
              <button type="button" onClick={() => onDelete(p)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-100 transition hover:bg-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Delete photo from ${fmtDate(p.takenAt)}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.li>
        ))}
      </ul>
      {view &&
        createPortal(
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Progress photo" onClick={() => setView(null)} onKeyDown={(e) => e.key === 'Escape' && setView(null)}>
            <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img src={view.url} alt={`${view.pose} progress photo from ${fmtDate(view.takenAt)}`} className="max-h-[80vh] rounded-2xl object-contain" />
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white">
                <div>
                  <p className="font-medium">{fmtDate(view.takenAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {view.note && <p className="text-white/70">{view.note}</p>}
                </div>
                <Badge className="capitalize">{view.pose}</Badge>
              </div>
              <Button autoFocus variant="secondary" size="sm" className="absolute right-2 top-2 h-9 w-9 !p-0" aria-label="Close" onClick={() => setView(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
