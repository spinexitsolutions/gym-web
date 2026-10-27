import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { ContactForm } from './ContactForm.jsx';
import { to12h, whatsappLink } from '../../utils/format.js';

export function MapEmbed({ query, title = 'Gym location map', className = '' }) {
  if (!query) return null;
  return (
    <iframe
      title={title}
      src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={`h-full w-full border-0 dark:grayscale-[60%] dark:invert-[0.88] dark:hue-rotate-180 ${className}`}
      allowFullScreen
    />
  );
}

export function ContactDetails({ contact }) {
  const rows = [
    { icon: MapPin, label: 'Address', value: <>{contact.address}<br />{contact.city}</> },
    { icon: Phone, label: 'Phone', value: <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-gold">{contact.phone}</a> },
    { icon: Mail, label: 'Email', value: <a href={`mailto:${contact.email}`} className="hover:text-gold">{contact.email}</a> },
  ];
  return (
    <div className="space-y-6">
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/40 text-gold"><Icon className="h-4 w-4" aria-hidden /></span>
          <div><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-1">{value}</p></div>
        </div>
      ))}
      <div className="flex gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/40 text-gold"><Clock className="h-4 w-4" aria-hidden /></span>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted">Working hours</p>
          <ul className="mt-1 space-y-1 text-sm">
            {contact.hours.map((h) => <li key={h.days} className="flex justify-between gap-4"><span className="text-muted">{h.days}</span><span>{to12h(h.open)} – {to12h(h.close)}</span></li>)}
          </ul>
        </div>
      </div>
      {contact.whatsapp && (
        <a href={whatsappLink(contact.whatsapp, contact.whatsappMessage)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/50 px-5 py-2.5 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/10">
          Chat on WhatsApp
        </a>
      )}
    </div>
  );
}

export function ContactSection({ contact }) {
  return (
    <Section id="contact">
      <SectionHeading eyebrow="Visit the club" title="Book your private tour" lead="Tell us about your goals and a membership advisor will reach out within one business day." />
      <div className="grid gap-10 lg:grid-cols-2">
        <Reveal className="space-y-8">
          <ContactDetails contact={contact} />
          <div className="aspect-[16/10] overflow-hidden rounded-brand border border-line/10"><MapEmbed query={contact.mapQuery} /></div>
        </Reveal>
        <Reveal delay={0.1} className="glass relative rounded-brand p-6 md:p-10">
          <ContactForm source="homepage" />
        </Reveal>
      </div>
    </Section>
  );
}
