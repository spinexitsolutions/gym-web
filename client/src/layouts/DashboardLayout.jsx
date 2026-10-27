import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Sun, Moon, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Logo } from '../components/layout/Logo.jsx';
import { NotificationBell } from '../components/dashboard/NotificationBell.jsx';
import { Img } from '../components/ui/Img.jsx';
import { PageLoader } from '../components/ui/States.jsx';
import { cn } from '../utils/cn.js';

/**
 * nav: [{ group?: string, items: [{ to, label, icon, end?, roles? }] }]
 */
export function DashboardLayout({ nav, title, notificationsHref }) {
  const { user, logout } = useAuth();
  const { mode, toggle, canToggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  const allowed = (item) => !item.roles || user.role === 'owner' || item.roles.includes(user.role);
  const sidebar = (
    <nav aria-label={`${title} navigation`} className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5"><Logo /></div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
        {nav.map((g) => {
          const items = g.items.filter(allowed);
          if (!items.length) return null;
          return (
            <div key={g.group || 'main'}>
              {g.group && <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-eyebrow text-muted/80">{g.group}</p>}
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink to={to} end={end} className={({ isActive }) => cn('flex items-center gap-3 rounded-brand px-3 py-2 text-sm transition', isActive ? 'bg-gold/10 text-gold' : 'text-ink/75 hover:bg-ink/5 hover:text-ink')}>
                      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}{label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-brand px-3 py-2 text-sm text-muted hover:bg-ink/5 hover:text-ink"><ExternalLink className="h-4 w-4" aria-hidden />View website</Link>
        <button type="button" onClick={() => logout()} className="flex w-full items-center gap-3 rounded-brand px-3 py-2 text-sm text-muted hover:bg-ink/5 hover:text-ink"><LogOut className="h-4 w-4" aria-hidden />Log out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#dash-main" className="sr-only z-[60] rounded bg-gold px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line/10 bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line/10 bg-surface">
            <button type="button" className="absolute right-3 top-4 rounded-full p-2 text-muted" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line/10 bg-bg/85 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu className="h-5 w-5" /></button>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted">{title}</p>
          </div>
          <div className="flex items-center gap-1">
            {canToggle && (
              <button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" aria-label={mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>
                {mode === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
              </button>
            )}
            <NotificationBell allHref={notificationsHref} />
            <div className="ml-2 flex items-center gap-3 border-l border-line/10 pl-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-[0.7rem] capitalize text-muted">{user.role}</p>
              </div>
              <span className="h-9 w-9 overflow-hidden rounded-full border border-gold/40 bg-elevated">
                {user.avatar?.url ? <Img image={user.avatar} alt="" sizes="36px" className="h-full w-full" /> : <span className="grid h-full place-items-center font-display text-gold">{user.name[0]}</span>}
              </span>
            </div>
          </div>
        </header>
        <main id="dash-main" className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-10"><Suspense fallback={<PageLoader />}><Outlet /></Suspense></main>
      </div>
    </div>
  );
}
