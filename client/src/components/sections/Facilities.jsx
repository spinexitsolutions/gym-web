import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Img } from '../ui/Img.jsx';
import { iconFor } from '../../utils/icons.js';

export function Facilities({ facilities, title = 'Spaces engineered for performance', lead }) {
  if (!facilities?.length) return null;
  return (
    <Section id="facilities" className="bg-surface/30">
      <SectionHeading eyebrow="Facilities & equipment" title={title} lead={lead || 'Every zone is designed, equipped and maintained to the standard of a private members club.'} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.map((f, i) => {
          const Icon = iconFor(f.icon);
          return (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className="group relative aspect-[4/5] overflow-hidden rounded-brand sm:aspect-[3/4]">
              <Img image={f.image} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-full w-full transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-[#F4F1EA]">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-gold/50 bg-[#0B0B0C]/40 text-gold backdrop-blur"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="text-2xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#F4F1EA]/70">{f.description}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
