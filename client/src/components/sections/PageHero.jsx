import { Img } from '../ui/Img.jsx';
import { Reveal } from '../ui/Reveal.jsx';

export function PageHero({ eyebrow, title, lead, image }) {
  return (
    <section className="relative overflow-hidden border-b border-line/10">
      {image?.url && (
        <div className="absolute inset-0 -z-10">
          <Img image={image} priority decorative sizes="100vw" className="h-full w-full" />
          <div className="absolute inset-0 bg-[#0B0B0C]/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
        </div>
      )}
      <div className={`container py-20 md:py-28 ${image?.url ? 'text-[#F4F1EA]' : ''}`}>
        <Reveal className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-gold" aria-hidden />{eyebrow}</p>}
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] md:text-6xl">{title}</h1>
          {lead && <p className={`mt-6 max-w-2xl text-pretty text-lg leading-relaxed ${image?.url ? 'text-[#F4F1EA]/75' : 'text-muted'}`}>{lead}</p>}
        </Reveal>
      </div>
    </section>
  );
}
