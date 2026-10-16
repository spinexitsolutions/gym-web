import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react';
import { DEFAULT_THEME } from '@apex/shared';
import { homeForRole, useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { AnnouncementBar } from './AnnouncementBar';
import { BrandMark } from './Brand';
import { SmartLink } from './SmartLink';

export interface NavItem {
  label: string;
  to: string;
  /** Hidden in the compact desktop nav (still shown in the drawer). */
  wideOnly?: boolean;
}

/** Primary navigation: fixed pages + CMS pages flagged "show in nav". */
export function usePublicNav(): NavItem[] {
  const { site } = useSite();
  const fixed: NavItem[] = [
    { label: 'Home', to: '/', wideOnly: true },
    { label: 'About', to: '/about' },
    { label: 'Programs', to: '/programs' },
    { label: 'Trainers', to: '/trainers' },
    { label: 'Memberships', to: '/memberships' },
    { label: 'Results', to: '/#results' },
  ];
  const known = new Set(fixed.map((f) => f.to));
  const cms = (site?.nav ?? []).filter((p) => p.slug && !known.has(`/${p.slug}`)).map((p) => ({ label: p.title || p.slug, to: `/${p.slug}`, wideOnly: true }));
  return [...fixed, ...cms, { label: 'Contact', to: '/contact' }];
}

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

function NavItemLink({ item, className, onClick }: { item: NavItem; className?: string; onClick?: () => void }) {
  const { pathname, hash } = useLocation();
  if (item.to.includes('#')) {
    const [path, h] = item.to.split('#');
    const current = pathname === (path || '/') && hash === `#${h}`;
    return (
      <Link to={item.to} onClick={onClick} aria-current={current ? 'page' : undefined} className={className}>
        {item.label}
      </Link>
    );
  }
  return (
    <NavLink to={item.to} end={item.to === '/'} onClick={onClick} className={className}>
      {item.label}
    </NavLink>
  );
}

/** Fixed site chrome: announcement bar + header. Transparent over the hero, solid after scrolling. */
export function Header() {
  const { site } = useSite();
  const { user } = useAuth();
  const theme = site?.theme ?? DEFAULT_THEME;
  const nav = usePublicNav();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const chrome = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  // Expose the chrome height so heroes can pad below it without layout shift.
  useLayoutEffect(() => {
    const el = chrome.current;
    if (!el) return;
    const set = () => {
      if (window.scrollY < 24) document.documentElement.style.setProperty('--chrome-h', `${el.offsetHeight}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const solid = !theme.header.transparentOnTop || scrolled || open;
  const cta = theme.header.ctaLabel ? { label: theme.header.ctaLabel, href: theme.header.ctaHref || '/memberships' } : null;
  const linkCls = 'nav-link rounded-full px-3 py-2 text-[0.82rem] font-medium tracking-wide text-fg/75 transition-colors hover:text-fg aria-[current=page]:text-fg';

  return (
    <>
      <div ref={chrome} className="fixed inset-x-0 top-0 z-50">
        <AnnouncementBar collapsed={scrolled} />
        <header className={cn('transition-[background-color,box-shadow,backdrop-filter] duration-500', solid ? 'header-solid' : 'bg-transparent')}>
          <div className={cn('container flex items-center justify-between gap-4 transition-[height] duration-500', scrolled ? 'h-16' : 'h-[4.5rem] md:h-20')}>
            <BrandMark />
            <nav aria-label="Primary" className="hidden lg:block">
              <ul className="flex items-center gap-0.5">
                {nav.map((item) => (
                  <li key={item.to} className={cn(item.wideOnly && 'hidden xl:block')}>
                    <NavItemLink item={item} className={linkCls} />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-2">
              {user ? (
                <Link to={homeForRole(user.role)} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Dashboard
                </Link>
              ) : (
                theme.header.showLogin && (
                  <Link to="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                    Log in
                  </Link>
                )
              )}
              {cta && (
                <SmartLink href={cta.href} className="btn btn-primary btn-sm group hidden sm:inline-flex">
                  {cta.label}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </SmartLink>
              )}
              <button
                ref={toggle}
                type="button"
                onClick={() => setOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-fg/15 text-fg transition hover:border-fg/30 lg:hidden"
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="mobile-menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>
      </div>
      <MobileDrawer open={open} onClose={() => setOpen(false)} nav={nav} returnFocus={toggle} cta={cta} />
    </>
  );
}

function MobileDrawer({ open, onClose, nav, returnFocus, cta }: { open: boolean; onClose: () => void; nav: NavItem[]; returnFocus: React.RefObject<HTMLButtonElement>; cta: { label: string; href: string } | null }) {
  const { site } = useSite();
  const { user } = useAuth();
  const panel = useRef<HTMLDivElement>(null);
  const showLogin = site?.theme.header.showLogin ?? true;
  const contact = site?.settings.contact;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const toggleEl = returnFocus.current;
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      toggleEl?.focus();
    };
  }, [open, onClose, returnFocus]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-bg/[0.97] backdrop-blur-xl lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div aria-hidden className="bg-aura pointer-events-none absolute inset-0" />
          <div className="container relative flex h-[4.5rem] shrink-0 items-center justify-between">
            <BrandMark onClick={onClose} />
            <button type="button" data-autofocus onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-fg/15 transition hover:border-fg/30" aria-label="Close menu">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <nav aria-label="Mobile" className="container relative mt-6 flex-1">
            <ul className="divide-y divide-fg/[0.07] border-y border-fg/[0.07]">
              {nav.map((item, i) => (
                <motion.li key={item.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i + 0.05, duration: 0.4 }}>
                  <NavItemLink item={item} onClick={onClose} className="group flex items-baseline justify-between py-4 font-display text-[1.9rem] font-semibold tracking-tight text-fg/85 transition hover:text-fg aria-[current=page]:text-primary" />
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {cta && (
                <SmartLink href={cta.href} onClick={onClose} className="btn btn-primary btn-lg flex-1">
                  {cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
                </SmartLink>
              )}
              {user ? (
                <Link to={homeForRole(user.role)} onClick={onClose} className="btn btn-secondary btn-lg flex-1">
                  <LayoutDashboard className="h-4 w-4" aria-hidden /> Dashboard
                </Link>
              ) : (
                showLogin && (
                  <Link to="/login" onClick={onClose} className="btn btn-secondary btn-lg flex-1">
                    Log in
                  </Link>
                )
              )}
            </div>
          </nav>
          {contact && (contact.phone || contact.email) && (
            <div className="container relative mt-10 pb-10 text-sm text-muted">
              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="block py-1 transition hover:text-fg">
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="block py-1 transition hover:text-fg">
                  {contact.email}
                </a>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
