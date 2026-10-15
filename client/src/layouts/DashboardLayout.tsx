import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ExternalLink, LogOut, Menu, X } from 'lucide-react';
import type { Permission } from '@apex/shared';
import { useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
  end?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface Props {
  area: 'Admin' | 'Member' | 'Trainer';
  nav: NavGroup[];
  notificationsHref: string;
  footer?: ReactNode;
}

function Brand({ area }: { area: string }) {
  const { site, brandName } = useSite();
  const logo = site?.settings.brand.logoUrl;
  return (
    <Link to="/" className="flex items-center gap-3 px-2">
      {logo ? (
        <img src={logo} alt={site?.settings.brand.logoAlt || brandName} className="h-8 w-auto" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-on-primary">{brandName.charAt(0)}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-semibold uppercase tracking-[0.18em]">{site?.settings.brand.shortName || brandName}</span>
        <span className="block text-[0.65rem] uppercase tracking-[0.22em] text-muted">{area}</span>
      </span>
    </Link>
  );
}

function SideNav({ nav, onNavigate }: { nav: NavGroup[]; onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Dashboard" className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {nav.map((g, gi) => {
        const items = g.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.label && <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted/80">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn('group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary/12 text-primary' : 'text-fg/75 hover:bg-fg/[0.05] hover:text-fg')
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function DashboardLayout({ area, nav, notificationsHref, footer }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => (await api.getPaged<unknown[]>('/notifications/me', { limit: 1, unread: true })).meta?.unreadCount as number,
    refetchInterval: 60_000,
  });

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-line/70 px-3">
        <Brand area={area} />
      </div>
      <SideNav nav={nav} onNavigate={() => setOpen(false)} />
      {footer}
      <div className="border-t border-line/70 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user?.name ?? ''} src={user?.avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-muted transition hover:bg-fg/5 hover:text-fg" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line/70 bg-surface/60 backdrop-blur-xl lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface" aria-label="Navigation">
              <button className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/70 bg-bg/80 px-4 backdrop-blur-xl md:px-8">
          <button className="rounded-lg p-2 text-fg/80 hover:bg-fg/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Link to="/" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted transition hover:text-fg sm:inline-flex">
            View website <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link to={notificationsHref} className="relative rounded-full p-2 text-fg/80 transition hover:bg-fg/5" aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`}>
            <Bell className="h-5 w-5" />
            {Boolean(unread.data) && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-on-primary">{unread.data! > 9 ? '9+' : unread.data}</span>}
          </Link>
        </header>
        <main id="main" className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
