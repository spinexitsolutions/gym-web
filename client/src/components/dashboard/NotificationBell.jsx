import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '../../services/api.js';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

export function NotificationBell({ allHref }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const count = useQuery({ queryKey: ['notifications', 'count'], queryFn: async () => (await api.get('/notifications/unread-count')).data.unread, refetchInterval: 60_000 });
  const list = useQuery({ queryKey: ['notifications', 'recent'], queryFn: async () => (await api.get('/notifications?limit=8')).data, enabled: open });

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const openItem = async (n) => {
    if (!n.readAt) await api.post(`/notifications/${n._id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
    setOpen(false);
    if (n.link) navigate(n.link);
  };
  const unread = count.data || 0;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.6rem] font-bold text-[#0B0B0C]">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-brand border border-line/10 bg-elevated shadow-card">
          <div className="flex items-center justify-between border-b border-line/10 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button type="button" className="text-xs text-gold hover:underline" onClick={async () => { await api.post('/notifications/read-all'); qc.invalidateQueries({ queryKey: ['notifications'] }); }}>Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {list.isLoading && <li className="p-4"><div className="skeleton h-10" /></li>}
            {list.data?.length === 0 && <li className="p-6 text-center text-sm text-muted">You're all caught up.</li>}
            {list.data?.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => openItem(n)} className={cn('block w-full border-b border-line/5 px-4 py-3 text-left hover:bg-ink/5', !n.readAt && 'bg-gold/5')}>
                  <p className="flex items-center gap-2 text-sm font-medium">{!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="Unread" />}{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                  <p className="mt-1 text-[0.65rem] text-muted">{formatDate(n.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                </button>
              </li>
            ))}
          </ul>
          {allHref && <Link to={allHref} onClick={() => setOpen(false)} className="block border-t border-line/10 px-4 py-3 text-center text-xs text-gold hover:underline">View all notifications</Link>}
        </div>
      )}
    </div>
  );
}
