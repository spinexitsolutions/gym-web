import { useQuery } from '@tanstack/react-query';
import { Award, ShieldCheck, Target, Telescope } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings.js';
import { contentApi } from '../../services/content.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Facilities } from '../../components/sections/Facilities.jsx';
import { FeaturedTrainers } from '../../components/sections/Trainers.jsx';
import { Section, SectionHeading } from '../../components/ui/Section.jsx';
import { Reveal } from '../../components/ui/Reveal.jsx';
import { Img } from '../../components/ui/Img.jsx';

function Gallery() {
  const q = useQuery({ queryKey: ['gallery', 'all'], queryFn: () => contentApi.gallery({ limit: 12 }) });
  const items = (q.data || []).filter((g) => g.category !== 'transformation' && g.image?.url);
  if (!items.length) return null;
  return (
    <Section id="gallery">
      <SectionHeading eyebrow="Gallery" title="Inside the club" />
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
        {items.map((g, i) => (
          <Reveal key={g._id} delay={(i % 3) * 0.06} className="group relative overflow-hidden rounded-brand break-inside-avoid">
            <Img image={g.image} alt={g.image.alt || g.title} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={`w-full transition duration-700 group-hover:scale-105 ${i % 3 === 1 ? 'aspect-[3/4]' : 'aspect-[4/3]'}`} />
            {g.title && <p className="absolute bottom-3 left-3 rounded-full bg-[#0B0B0C]/60 px-3 py-1 text-xs text-[#F4F1EA] backdrop-blur">{g.title}</p>}
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default function AboutPage() {
  const { data: s } = useSettings();
  const { about, certifications, safety, facilities } = s;
  return (
    <>
      <Seo title="About us" description={about.body.slice(0, 160)} path="/about" image={about.image?.url} />
      <PageHero eyebrow="About us" title={about.title} lead={about.body} image={s.hero.backgroundImage} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-4">Our story</p>
            <div className="space-y-5 text-pretty text-lg leading-relaxed text-muted">
              {about.story.split(/\n{2,}/).map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
            </div>
          </Reveal>
          <div className="grid gap-5">
            {[{ icon: Target, title: 'Mission', text: about.mission }, { icon: Telescope, title: 'Vision', text: about.vision }].map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 0.1} className="glass rounded-brand p-8">
                <Icon className="h-6 w-6 text-gold" aria-hidden />
                <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
                <p className="mt-3 leading-relaxed text-muted">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Facilities facilities={facilities} />
      <Gallery />

      {certifications.length > 0 && (
        <Section>
          <SectionHeading eyebrow="Recognition" title="Certifications & achievements" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {certifications.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.06} className="flex gap-4 rounded-brand border border-line/10 bg-surface p-6">
                <Award className="h-6 w-6 shrink-0 text-gold" aria-hidden />
                <div><p className="font-semibold">{c.title}</p><p className="mt-1 text-sm text-muted">{c.issuer} · {c.year}</p></div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <FeaturedTrainers />

      {safety.length > 0 && (
        <Section className="bg-surface/30">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading className="mb-8" eyebrow="Safety & hygiene" title="Clean, safe and cared for" lead="Standards we audit every week so you can focus entirely on training." />
              <div className="relative hidden aspect-[4/3] overflow-hidden rounded-brand lg:block"><Img image={about.secondaryImage} className="h-full w-full" sizes="40vw" /></div>
            </div>
            <ul className="grid content-start gap-4">
              {safety.map((item, i) => (
                <Reveal as="li" key={item.title} delay={i * 0.06} className="flex gap-4 rounded-brand border border-line/10 bg-surface p-6">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-gold" aria-hidden />
                  <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p></div>
                </Reveal>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </>
  );
}
