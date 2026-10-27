import { Check } from 'lucide-react';
import { Section } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Img } from '../ui/Img.jsx';
import { Button } from '../ui/Button.jsx';

export function About({ about, showLink = true }) {
  return (
    <Section id="about">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-brand">
            <Img image={about.image} sizes="(min-width: 1024px) 45vw, 100vw" className="h-full w-full" />
          </div>
          {about.secondaryImage?.url && (
            <div className="absolute -bottom-10 -right-4 hidden aspect-square w-[42%] overflow-hidden rounded-brand border-4 border-bg shadow-card sm:block md:-right-10">
              <Img image={about.secondaryImage} sizes="20vw" className="h-full w-full" />
            </div>
          )}
          <div className="absolute -left-4 -top-4 h-24 w-24 border-l border-t border-gold/60" aria-hidden />
        </Reveal>
        <div>
          <Reveal>
            <p className="eyebrow mb-4 flex items-center gap-3"><span className="h-px w-8 bg-gold" aria-hidden />{about.eyebrow}</p>
            <h2 className="text-balance text-3xl font-semibold leading-[1.1] md:text-5xl">{about.title}</h2>
            <p className="mt-6 text-pretty leading-relaxed text-muted md:text-lg">{about.body}</p>
          </Reveal>
          {about.highlights?.length > 0 && (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {about.highlights.map((h, i) => (
                <Reveal as="li" key={h} delay={i * 0.06} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><Check className="h-3 w-3" aria-hidden /></span>
                  {h}
                </Reveal>
              ))}
            </ul>
          )}
          {showLink && (
            <Reveal delay={0.2} className="mt-10">
              <Button to="/about" variant="outline">Our story</Button>
            </Reveal>
          )}
        </div>
      </div>
    </Section>
  );
}
