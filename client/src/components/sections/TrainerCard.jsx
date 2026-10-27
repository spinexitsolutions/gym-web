import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Img } from '../ui/Img.jsx';

export function TrainerCard({ trainer }) {
  return (
    <Link to={`/trainers/${trainer.slug}`} className="group block overflow-hidden rounded-brand border border-line/10 bg-surface transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-glow">
      <div className="relative aspect-[4/5] overflow-hidden">
        <Img image={trainer.photo} alt={trainer.name} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="h-full w-full grayscale-[35%] transition duration-700 group-hover:scale-105 group-hover:grayscale-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C]/90 via-transparent" />
        <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#0B0B0C]/50 text-gold opacity-0 backdrop-blur transition group-hover:opacity-100" aria-hidden>
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5 text-[#F4F1EA]">
          <p className="text-[0.65rem] uppercase tracking-eyebrow text-gold">{trainer.title}</p>
          <h3 className="mt-1 text-2xl font-semibold">{trainer.name}</h3>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-5">
        {trainer.specializations?.slice(0, 3).map((s) => (
          <span key={s} className="rounded-full border border-line/15 px-3 py-1 text-xs text-muted">{s}</span>
        ))}
        <span className="ml-auto text-xs text-muted">{trainer.experienceYears} yrs exp.</span>
      </div>
    </Link>
  );
}

export function TrainerCardSkeleton() {
  return <div className="skeleton aspect-[4/6]" />;
}
