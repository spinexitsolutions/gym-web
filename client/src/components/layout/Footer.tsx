import { Link } from 'react-router-dom';
import { ArrowUpRight, Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { DEFAULT_THEME } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { NewsletterForm } from '@/features/sections/forms';
import { fullAddress, groupedHours, directionsUrl } from '@/features/sections/hours';
import { BrandMark } from './Brand';
import { SmartLink } from './SmartLink';

const SOCIAL = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'x', label: 'X', Icon: Twitter },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
] as const;

export function Footer() {
  const { site, brandName } = useSite();
  const s = site?.settings;
  const theme = site?.theme ?? DEFAULT_THEME;
  const year = new Date().getFullYear();
  const explore = [
    { label: 'Programs', to: '/programs' },
    { label: 'Class schedule', to: '/schedule' },
    { label: 'Trainers', to: '/trainers' },
    { label: 'Memberships', to: '/memberships' },
    { label: 'Journal', to: '/blog' },
  ];
  const club = [
    { label: 'About', to: '/about' },
    { label: 'Results', to: '/#results' },
    { label: 'Free trial', to: '/#trial' },
    { label: 'Contact', to: '/contact' },
    ...(site?.nav ?? []).filter((n) => n.slug !== 'about').map((n) => ({ label: n.title, to: `/${n.slug}` })),
  ];
  const address = s ? fullAddress(s.contact) : '';
  const hours = s ? groupedHours(s.hours) : [];
  const socials = SOCIAL.filter((x) => s?.social[x.key]);

  return (
    <footer className="relative isolate overflow-hidden border-t border-fg/[0.07] bg-bg" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Site footer
      </h2>
      <div aria-hidden className="bg-aura pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="container pt-20 md:pt-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <BrandMark />
            {theme.footer.tagline && <p className="mt-6 max-w-sm text-pretty leading-relaxed text-muted">{theme.footer.tagline}</p>}
            {theme.footer.showNewsletter && (
              <div className="mt-10 max-w-md">
                <p className="mb-3 font-display text-lg font-semibold tracking-tight">Training notes, monthly</p>
                <NewsletterForm source="footer" compact />
              </div>
            )}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Explore</p>
              <ul className="mt-5 space-y-3 text-sm">
                {explore.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-fg/80 transition hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Club</p>
              <ul className="mt-5 space-y-3 text-sm">
                {club.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-fg/80 transition hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Visit</p>
              <div className="mt-5 space-y-3 text-sm">
                {address && s && (
                  <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer" className="group block text-fg/80 transition hover:text-fg">
                    <address className="not-italic leading-relaxed">{address}</address>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted group-hover:text-primary">
                      Directions <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </span>
                  </a>
                )}
                {s?.contact.phone && (
                  <a href={`tel:${s.contact.phone.replace(/\s/g, '')}`} className="block text-fg/80 transition hover:text-fg">
                    {s.contact.phone}
                  </a>
                )}
                {s?.contact.email && (
                  <a href={`mailto:${s.contact.email}`} className="block break-all text-fg/80 transition hover:text-fg">
                    {s.contact.email}
                  </a>
                )}
                {hours.length > 0 && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-2 text-xs">
                    {hours.map((h) => (
                      <div key={h.label} className="contents">
                        <dt className="text-muted">{h.label}</dt>
                        <dd className="text-right tabular-nums text-fg/75">{h.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-16 flex flex-col-reverse gap-6 border-t border-fg/[0.07] py-8 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {(s?.business.legalName || brandName).replace(/\.$/, '')}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {s?.privacy.privacyPolicyUrl && (
              <SmartLink href={s.privacy.privacyPolicyUrl} className="transition hover:text-fg">
                Privacy
              </SmartLink>
            )}
            {s?.privacy.termsUrl && (
              <SmartLink href={s.privacy.termsUrl} className="transition hover:text-fg">
                Terms
              </SmartLink>
            )}
            {socials.length > 0 && (
              <ul className="flex items-center gap-2" aria-label="Social media">
                {socials.map(({ key, label, Icon }) => (
                  <li key={key}>
                    <a href={s!.social[key]} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} className="grid h-9 w-9 place-items-center rounded-full border border-fg/10 text-fg/70 transition hover:border-primary/40 hover:text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <p aria-hidden className="text-outline pointer-events-none -mb-[0.18em] select-none whitespace-nowrap text-center font-display text-[18vw] font-semibold uppercase leading-none tracking-tighter opacity-60">
        {s?.brand.shortName || brandName}
      </p>
    </footer>
  );
}
