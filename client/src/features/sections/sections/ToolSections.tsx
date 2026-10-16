import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { ACTIVITY_LEVELS, bmiCategory, calculateBmi, estimateCalories, type ActivityLevel, type SectionProps } from '@apex/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { Reveal } from '@/components/layout/Reveal';
import { SceneCanvas } from '@/3d/SceneCanvas';
import { ContactForm, NewsletterForm, TrialForm } from '../forms';
import { DAY_LABEL, directionsUrl, fmtClock, fullAddress, groupedHours, sortedHours, todayKey } from '../hours';
import { EmptyPlaceholder, SectionHeading, SectionShell, useHeadingId } from '../primitives';

/* ---------------------------------------------------------------------- bmi */

const toneClass = { info: 'text-sky-300', success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const;

export function BmiSection({ p }: { p: SectionProps<'bmi'> }) {
  const headingId = useHeadingId(p);
  const uid = useId();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const h = Number(height);
  const w = Number(weight);
  const validH = h >= 100 && h <= 250;
  const validW = w >= 30 && w <= 300;
  const bmi = validH && validW ? calculateBmi(w, h) : null;
  const cat = bmi ? bmiCategory(bmi) : null;
  const cals = p.showCalorieEstimate && bmi && Number(age) ? estimateCalories({ weightKg: w, heightCm: h, age: Number(age), sex, activity }) : null;
  // Marker on a 15–40 scale
  const pos = bmi ? Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100)) : null;

  const field = 'input h-12 text-base';
  return (
    <SectionShell type="bmi" props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} />
        <Reveal className="card grid overflow-hidden lg:grid-cols-2">
          <form className="grid gap-5 p-7 sm:grid-cols-2 md:p-10" onSubmit={(e) => e.preventDefault()} aria-label="BMI calculator">
            <div>
              <label htmlFor={`${uid}-h`} className="label">
                Height (cm)
              </label>
              <input id={`${uid}-h`} className={field} type="number" inputMode="decimal" min={100} max={250} placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} aria-invalid={height !== '' && !validH ? true : undefined} />
              {height !== '' && !validH && <p className="mt-1.5 text-xs text-danger">Enter a height between 100 and 250 cm.</p>}
            </div>
            <div>
              <label htmlFor={`${uid}-w`} className="label">
                Weight (kg)
              </label>
              <input id={`${uid}-w`} className={field} type="number" inputMode="decimal" min={30} max={300} placeholder="72" value={weight} onChange={(e) => setWeight(e.target.value)} aria-invalid={weight !== '' && !validW ? true : undefined} />
              {weight !== '' && !validW && <p className="mt-1.5 text-xs text-danger">Enter a weight between 30 and 300 kg.</p>}
            </div>
            {p.showCalorieEstimate && (
              <>
                <div>
                  <label htmlFor={`${uid}-a`} className="label">
                    Age
                  </label>
                  <input id={`${uid}-a`} className={field} type="number" inputMode="numeric" min={15} max={100} placeholder="30" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <fieldset>
                  <legend className="label">Sex (for the formula)</legend>
                  <div className="flex h-12 gap-1 rounded-btn border border-line p-1">
                    {(['female', 'male'] as const).map((s) => (
                      <label key={s} className={cn('flex flex-1 cursor-pointer items-center justify-center rounded-btn text-sm capitalize transition', sex === s ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg')}>
                        <input type="radio" name={`${uid}-sex`} value={s} checked={sex === s} onChange={() => setSex(s)} className="sr-only" />
                        {s}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <label htmlFor={`${uid}-act`} className="label">
                    Activity level
                  </label>
                  <select id={`${uid}-act`} className={cn(field, 'appearance-none')} value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
                    {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </form>
          <div className="metal-panel flex flex-col justify-between gap-8 border-t border-fg/[0.08] p-7 md:p-10 lg:border-l lg:border-t-0" aria-live="polite">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Your BMI</p>
              <p className="mt-3 font-display text-7xl font-semibold tabular-nums tracking-tight">{bmi ? bmi.toFixed(1) : '—'}</p>
              <p className={cn('mt-2 font-medium', cat ? toneClass[cat.tone] : 'text-muted')}>{cat ? cat.label : 'Enter your height and weight'}</p>
              <div className="relative mt-8" aria-hidden>
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  <span className="w-[14%] bg-sky-400/60" />
                  <span className="w-[26%] bg-success/70" />
                  <span className="w-[20%] bg-warning/70" />
                  <span className="flex-1 bg-danger/60" />
                </div>
                {pos !== null && <span className="absolute -top-1.5 h-4 w-1 -translate-x-1/2 rounded-full bg-fg shadow transition-[left] duration-500" style={{ left: `${pos}%` }} />}
                <div className="mt-2 flex justify-between text-[0.65rem] tabular-nums text-muted">
                  <span>15</span>
                  <span>18.5</span>
                  <span>25</span>
                  <span>30</span>
                  <span>40</span>
                </div>
              </div>
              {cals && (
                <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-fg/[0.08] pt-6">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted">Resting (BMR)</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{cals.bmr.toLocaleString('en-IN')} kcal</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted">Maintenance</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{cals.maintenance.toLocaleString('en-IN')} kcal</dd>
                  </div>
                </dl>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              An estimate only — not medical advice. BMI doesn’t account for muscle mass, bone density, age or body-fat distribution, so athletes often read “above range”.{' '}
              {p.showCalorieEstimate && 'Calories use the Mifflin–St Jeor equation and vary by individual. '}
              Speak to a doctor or registered dietitian before major changes.
            </p>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ----------------------------------------------------------------- location */

function HoursTable({ hours, timezone }: { hours: ReturnType<typeof sortedHours>; timezone?: string }) {
  const today = todayKey(timezone);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Opening hours</caption>
      <tbody>
        {hours.map((h) => (
          <tr key={h.day} className={cn('border-b border-fg/[0.07] last:border-0', h.day === today && 'text-fg')} aria-current={h.day === today ? 'date' : undefined}>
            <th scope="row" className={cn('py-2.5 text-left font-normal', h.day === today ? 'text-fg' : 'text-muted')}>
              {DAY_LABEL[h.day]}
              {h.day === today && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-primary">Today</span>}
            </th>
            <td className="py-2.5 text-right tabular-nums">{h.closed ? 'Closed' : `${fmtClock(h.open)} – ${fmtClock(h.close)}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Stylised, script-free "map": a grid with streets and a pin. Links out for directions. */
function MapCard({ href, label }: { href: string; label: string }) {
  return (
    <div className="metal-panel relative h-full min-h-[320px] overflow-hidden rounded-theme border border-fg/[0.08]">
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600">
        <g style={{ stroke: 'rgb(var(--c-text) / 0.06)' }} strokeWidth="1">
          {Array.from({ length: 21 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="600" />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 40} x2="800" y2={i * 40} />
          ))}
        </g>
        <g fill="none" strokeLinecap="round" style={{ stroke: 'rgb(var(--c-text) / 0.14)' }}>
          <path d="M-20 420 C 180 380, 300 330, 420 300 S 700 220, 840 160" strokeWidth="14" />
          <path d="M260 -20 L 330 620" strokeWidth="9" />
          <path d="M-20 160 L 840 250" strokeWidth="6" />
          <path d="M560 -20 C 540 200, 600 380, 520 620" strokeWidth="6" />
        </g>
        <path d="M-20 420 C 180 380, 300 330, 420 300 S 700 220, 840 160" fill="none" strokeWidth="1" strokeDasharray="6 10" style={{ stroke: 'rgb(var(--c-primary) / 0.45)' }} />
        <circle cx="420" cy="300" r="90" style={{ fill: 'rgb(var(--c-primary) / 0.06)', stroke: 'rgb(var(--c-primary) / 0.25)' }} />
        <circle cx="420" cy="300" r="40" style={{ fill: 'rgb(var(--c-primary) / 0.12)' }} />
        <circle cx="420" cy="300" r="9" style={{ fill: 'rgb(var(--c-primary))' }} />
      </svg>
      <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-center justify-between gap-3 rounded-theme-sm border border-fg/10 bg-bg/70 p-4 backdrop-blur">
        <p className="text-sm text-fg/85">{label}</p>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            Get directions <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only"> (opens Google Maps in a new tab)</span>
          </a>
        )}
      </div>
    </div>
  );
}

export function LocationSection({ p }: { p: SectionProps<'location'> }) {
  const headingId = useHeadingId(p);
  const { site, brandName } = useSite();
  const s = site?.settings;
  if (!s) return null;
  const address = fullAddress(s.contact);
  const hours = sortedHours(s.hours);
  if (!address && !hours.length) return <EmptyPlaceholder type="location" label="Location" where="Admin → Settings (address & opening hours)" />;
  const dir = directionsUrl(s);
  return (
    <SectionShell type="location" props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} />
        <div className={cn('grid gap-6', p.showMap && 'lg:grid-cols-[1fr_1.4fr]')}>
          <Reveal className="card flex flex-col gap-8 p-7 md:p-9">
            {address && (
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Address
                </p>
                <address className="mt-3 not-italic text-lg leading-relaxed">{address}</address>
                {dir && !p.showMap && (
                  <a href={dir} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
                    Get directions <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
              </div>
            )}
            {(s.contact.phone || s.contact.email) && (
              <div className="grid gap-2 text-sm">
                {s.contact.phone && (
                  <a href={`tel:${s.contact.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 text-fg/85 hover:text-primary">
                    <Phone className="h-4 w-4 text-muted" aria-hidden /> {s.contact.phone}
                  </a>
                )}
                {s.contact.email && (
                  <a href={`mailto:${s.contact.email}`} className="inline-flex items-center gap-2 text-fg/85 hover:text-primary">
                    <Mail className="h-4 w-4 text-muted" aria-hidden /> {s.contact.email}
                  </a>
                )}
              </div>
            )}
            {p.showHours && hours.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> Opening hours
                </p>
                <HoursTable hours={hours} timezone={s.business.timezone} />
              </div>
            )}
          </Reveal>
          {p.showMap && (
            <Reveal delay={0.1}>
              {s.location.mapEmbedUrl ? (
                <iframe
                  title={`Map showing ${brandName}`}
                  src={s.location.mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full min-h-[360px] w-full rounded-theme border border-fg/[0.08] grayscale-[60%]"
                />
              ) : (
                <MapCard href={dir} label={[brandName, s.contact.city].filter(Boolean).join(' · ')} />
              )}
            </Reveal>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/* --------------------------------------------------------------- trial form */

export function TrialFormSection({ p }: { p: SectionProps<'trialForm'> }) {
  const headingId = useHeadingId(p);
  const steps = ['Tour the floor & recovery suite', 'Movement assessment with a coach', 'A full coached session'];
  return (
    <SectionShell type="trialForm" props={p} labelledBy={headingId}>
      <div className="container grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
          {p.heading && (
            <h2 id={headingId} className="text-balance font-display text-display-lg font-semibold">
              {p.heading}
            </h2>
          )}
          {(p.body || p.subheading) && <p className="mt-5 text-lg leading-relaxed text-muted">{p.body || p.subheading}</p>}
          <ol className="mt-10 space-y-0 border-t border-fg/[0.08]">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-4 border-b border-fg/[0.08] py-4 text-fg/85">
                <span className="font-display text-xs tabular-nums text-primary">{String(i + 1).padStart(2, '0')}</span>
                {s}
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={0.1} className="card p-6 md:p-10 lg:col-span-7">
          <TrialForm successMessage={p.successMessage} />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ contact */

export function ContactDetails() {
  const { site } = useSite();
  const s = site?.settings;
  if (!s) return null;
  const c = s.contact;
  const wa = c.whatsapp.replace(/[^\d]/g, '');
  const rows = [
    c.phone && { icon: Phone, label: 'Call', value: c.phone, href: `tel:${c.phone.replace(/\s/g, '')}` },
    wa && { icon: MessageCircle, label: 'WhatsApp', value: c.whatsapp, href: `https://wa.me/${wa}` },
    c.email && { icon: Mail, label: 'Email', value: c.email, href: `mailto:${c.email}` },
    fullAddress(c) && { icon: MapPin, label: 'Visit', value: fullAddress(c), href: directionsUrl(s) },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string }[];
  const grouped = groupedHours(s.hours);
  return (
    <div className="grid gap-8">
      <ul className="divide-y divide-fg/[0.08] border-y border-fg/[0.08]">
        {rows.map((r) => (
          <li key={r.label}>
            <a href={r.href} {...(/^https?:/.test(r.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="group flex items-center gap-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-fg/10 text-muted transition group-hover:border-primary/40 group-hover:text-primary">
                <r.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.18em] text-muted">{r.label}</span>
                <span className="block truncate text-fg/90 transition group-hover:text-fg">{r.value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {grouped.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {grouped.map((g) => (
            <div key={g.label} className="contents">
              <dt className="text-muted">{g.label}</dt>
              <dd className="text-right tabular-nums text-fg/85">{g.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function ContactSection({ p }: { p: SectionProps<'contact'> }) {
  const headingId = useHeadingId(p);
  return (
    <SectionShell type="contact" props={p} labelledBy={headingId}>
      <div className="container grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
          {p.heading && (
            <h2 id={headingId} className="text-balance font-display text-display-lg font-semibold">
              {p.heading}
            </h2>
          )}
          {(p.body || p.subheading) && <p className="mb-10 mt-5 text-lg leading-relaxed text-muted">{p.body || p.subheading}</p>}
          <ContactDetails />
        </Reveal>
        <Reveal delay={0.1} className="card p-6 md:p-10 lg:col-span-7">
          <ContactForm />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* --------------------------------------------------------------- newsletter */

export function NewsletterSection({ p }: { p: SectionProps<'newsletter'> }) {
  const headingId = useHeadingId(p);
  return (
    <SectionShell type="newsletter" props={p} labelledBy={headingId}>
      <div className="container">
        <Reveal className="grid items-end gap-10 border-y border-fg/[0.08] py-12 md:py-16 lg:grid-cols-2 lg:gap-20">
          <div>
            {p.eyebrow && <p className="eyebrow mb-5">{p.eyebrow}</p>}
            {p.heading && (
              <h2 id={headingId} className="text-balance font-display text-display-md font-semibold">
                {p.heading}
              </h2>
            )}
            {(p.body || p.subheading) && <p className="mt-4 max-w-lg text-muted">{p.body || p.subheading}</p>}
          </div>
          <NewsletterForm source="newsletter-section" />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* -------------------------------------------------------------- equipment3d */

export function Equipment3dSection({ p }: { p: SectionProps<'equipment3d'> }) {
  const headingId = useHeadingId(p);
  const [active, setActive] = useState(0);
  const uid = useId();
  const item = p.items[Math.min(active, p.items.length - 1)];
  const config = useMemo(() => ({ ...p.scene, modelId: item?.modelId || p.scene.modelId, scrollAnimation: false }), [p.scene, item?.modelId]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = (active + dir + p.items.length) % p.items.length;
    setActive(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };
  return (
    <SectionShell type="equipment3d" props={p} labelledBy={headingId}>
      <div className="container">
        <SectionHeading props={p} id={headingId} />
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div role="tablist" aria-label="Equipment" aria-orientation="vertical" onKeyDown={onKey} className="order-2 flex flex-col border-t border-fg/[0.08] lg:order-1 lg:col-span-4">
            {p.items.map((it, i) => (
              <button
                key={`${it.title}-${i}`}
                id={`${uid}-tab-${i}`}
                role="tab"
                type="button"
                aria-selected={i === active}
                aria-controls={`${uid}-panel`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn('group relative border-b border-fg/[0.08] py-6 pl-6 text-left transition', i === active ? 'text-fg' : 'text-fg/50 hover:text-fg/80')}
              >
                <span aria-hidden className={cn('absolute left-0 top-6 h-[calc(100%-3rem)] w-px transition', i === active ? 'bg-primary' : 'bg-fg/10')} />
                <span className="flex items-baseline gap-4">
                  <span className="font-display text-xs tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-xl font-semibold tracking-tight md:text-2xl">{it.title}</span>
                </span>
                {it.description && <span className={cn('mt-2 block pl-8 text-sm leading-relaxed text-muted transition-opacity', i === active ? 'opacity-100' : 'opacity-0 lg:opacity-60')}>{it.description}</span>}
              </button>
            ))}
          </div>
          <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${active}`} className="metal-panel relative order-1 aspect-[4/3] overflow-hidden rounded-theme border border-fg/[0.08] lg:order-2 lg:col-span-8 lg:aspect-[16/11]">
            <div aria-hidden className="bg-grid-fade absolute inset-0 opacity-50" />
            <div aria-hidden className="bg-aura absolute inset-0" />
            {item && <SceneCanvas config={config} label={`3D model: ${item.title}. Drag horizontally to rotate.`} className="absolute inset-0" />}
            <p aria-hidden className="pointer-events-none absolute bottom-5 left-6 text-[0.65rem] uppercase tracking-[0.3em] text-muted">
              {p.scene.interactive ? 'Drag to rotate' : item?.title}
            </p>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

