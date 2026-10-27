import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo.jsx';
import { Button } from '../ui/Button.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../utils/cn.js';
import { homeFor } from '../../utils/redirect.js';

export const NAV = [
  { to: '/about', label: 'About' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/programs', label: 'Programs' },
  { to: '/trainers', label: 'Trainers' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/contact', label: 'Contact' },
];

function ThemeToggle() {
  const { mode, toggle, canToggle } = useTheme();
  if (!canToggle) return null;
  const light = mode === 'light';
  return (
    <button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink" aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}>
      {light ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const menuRef = useRef(null);
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    menuRef.current?.querySelector('a')?.focus();
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const accountHref = user ? homeFor(user) : '/login';
  const solid = scrolled || !isHome || open;

  return (
    <header className={cn('sticky top-0 z-40 transition-all duration-300', solid ? 'glass border-x-0 border-t-0' : 'bg-transparent')}>
      <div className="container flex h-[72px] items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-full px-4 py-2 text-[0.8rem] font-medium uppercase tracking-[0.16em] transition hover:text-gold', isActive ? 'text-gold' : 'text-ink/80')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NavLink to={accountHref} className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm text-ink/80 transition hover:text-gold sm:flex">
            <UserRound className="h-[18px] w-[18px]" aria-hidden />
            <span>{user ? 'My account' : 'Log in'}</span>
          </NavLink>
          {!user && <Button to="/register" size="sm" className="ml-2 hidden sm:inline-flex">Join now</Button>}
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full lg:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            ref={menuRef}
            aria-label="Mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'calc(100dvh - 72px)' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-y-auto border-t border-line/10 bg-bg lg:hidden"
          >
            <div className="container flex flex-col gap-1 py-8">
              {NAV.map((n, i) => (
                <motion.div key={n.to} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                  <NavLink to={n.to} className={({ isActive }) => cn('block border-b border-line/10 py-4 font-display text-3xl', isActive && 'text-gold')}>
                    {n.label}
                  </NavLink>
                </motion.div>
              ))}
              <div className="mt-8 grid gap-3">
                <Button to={accountHref} variant="outline" size="lg">{user ? 'My account' : 'Log in'}</Button>
                {!user && <Button to="/register" size="lg">Join now</Button>}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
