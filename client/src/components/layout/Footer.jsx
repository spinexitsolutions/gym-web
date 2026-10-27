import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings.js';
import { Logo } from './Logo.jsx';
import { SocialIcons } from './SocialIcons.jsx';
import { to12h } from '../../utils/format.js';

export function Footer() {
  const { data: s } = useSettings();
  if (!s) return null;
  const { footer, contact, social } = s;
  return (
    <footer className="border-t border-line/10 bg-surface/40">
      <div className="container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-5">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted">{footer.blurb}</p>
          <SocialIcons social={social} />
        </div>
        <div>
          <h3 className="eyebrow mb-5">Explore</h3>
          <ul className="space-y-3 text-sm">
            {footer.links.map((l) => (
              <li key={l.href + l.label}><Link to={l.href} className="text-muted transition hover:text-gold">{l.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-5">Visit</h3>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /><span>{contact.address}<br />{contact.city}</span></li>
            <li className="flex gap-3"><Phone className="h-4 w-4 shrink-0 text-gold" aria-hidden /><a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-gold">{contact.phone}</a></li>
            <li className="flex gap-3"><Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden /><a href={`mailto:${contact.email}`} className="hover:text-gold">{contact.email}</a></li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-5">Hours</h3>
          <ul className="space-y-3 text-sm">
            {contact.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4 border-b border-line/10 pb-3 text-muted">
                <span>{h.days}</span>
                <span className="text-ink">{to12h(h.open)} – {to12h(h.close)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted sm:flex-row">
          <p>{footer.copyright}</p>
          <div className="flex gap-5">
            <Link to="/memberships#policies" className="hover:text-gold">Terms &amp; refunds</Link>
            <Link to="/contact" className="hover:text-gold">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
