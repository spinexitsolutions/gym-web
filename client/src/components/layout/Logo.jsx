import { Link } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings.js';
import { useTheme } from '../../context/ThemeContext.jsx';

export function Logo({ className = '' }) {
  const { data: s } = useSettings();
  const { mode } = useTheme();
  const name = s?.brand?.name || 'Aurum Fitness Club';
  const logo = mode === 'light' && s?.brand?.logoDark?.url ? s.brand.logoDark : s?.brand?.logo;
  const [first, ...rest] = name.split(' ');
  return (
    <Link to="/" className={`group inline-flex items-center gap-3 ${className}`} aria-label={`${name} home`}>
      {logo?.url ? (
        <img src={logo.url} alt={name} className="h-9 w-auto" />
      ) : (
        <>
          <span className="grid h-9 w-9 place-items-center rounded-brand border border-gold/50 font-display text-lg text-gold transition group-hover:bg-gold group-hover:text-bg">
            {first[0]}
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg tracking-wide">{first}</span>
            {rest.length > 0 && <span className="block text-[0.6rem] uppercase tracking-eyebrow text-muted">{rest.join(' ')}</span>}
          </span>
        </>
      )}
    </Link>
  );
}
