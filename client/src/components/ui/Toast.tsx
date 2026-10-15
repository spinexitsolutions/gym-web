import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  success: (title: string, body?: string) => void;
  error: (titleOrError: unknown, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((x) => x.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, title: string, body?: string) => {
      const id = ++seq;
      setItems((x) => [...x.slice(-3), { id, tone, title, body }]);
      setTimeout(() => remove(id), tone === 'error' ? 7000 : 4500);
    },
    [remove],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (t, b) => push('success', t, b),
      error: (t, b) => push('error', typeof t === 'string' ? t : errorMessage(t), b),
      info: (t, b) => push('info', t, b),
    }),
    [push],
  );
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex items-start gap-3 rounded-theme border border-line bg-surface/95 p-4 shadow-2xl backdrop-blur"
              >
                <I className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' && 'text-success', t.tone === 'error' && 'text-danger', t.tone === 'info' && 'text-primary')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                </div>
                <button aria-label="Dismiss" onClick={() => remove(t.id)} className="text-muted hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
