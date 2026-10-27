import { Outlet, Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings.js';
import { Img } from '../components/ui/Img.jsx';
import { Logo } from '../components/layout/Logo.jsx';

export function AuthLayout() {
  const { data: s } = useSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Img image={s?.about?.image || s?.hero?.backgroundImage} priority decorative sizes="50vw" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/50 to-[#0B0B0C]/20" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-[#F4F1EA]">
          <p className="eyebrow mb-4">{s?.brand?.name}</p>
          <p className="max-w-md font-display text-4xl font-semibold leading-tight">{s?.brand?.tagline}</p>
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between"><Logo /><Link to="/" className="text-sm text-muted hover:text-gold">Back to site</Link></div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12"><Outlet /></main>
      </div>
    </div>
  );
}

export function AuthHeading({ title, lead }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
      {lead && <p className="mt-3 text-muted">{lead}</p>}
    </div>
  );
}
