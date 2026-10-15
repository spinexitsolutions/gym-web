import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Static, theme-aware SVG composition shown while the 3D chunk loads, and as the permanent
 * fallback when WebGL is unavailable. No three.js here — this ships in the main bundle.
 *
 * Two silhouettes: a bumper plate seen front-on (hero / barbell / plate) and a hex dumbbell
 * in profile (dumbbell / kettlebell / bench / uploaded models).
 */
export function ScenePoster({ modelId, imageUrl, imageAlt = '', className }: { modelId: string; imageUrl?: string; imageAlt?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (imageUrl) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <img src={imageUrl} alt={imageAlt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
    );
  }
  const plate = ['hero-stack', 'barbell', 'weight-plate'].includes(modelId);
  return (
    <div className={cn('pointer-events-none absolute inset-0 grid place-items-center', className)} aria-hidden>
      <svg viewBox="0 0 600 600" className="h-full max-h-[620px] w-full max-w-[620px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={`${id}-rubber`} cx="38%" cy="32%" r="80%">
            <stop offset="0" style={{ stopColor: 'rgb(var(--c-text) / 0.16)' }} />
            <stop offset="0.45" style={{ stopColor: 'rgb(var(--c-surface))' }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--c-background))' }} />
          </radialGradient>
          <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'rgb(var(--c-text) / 0.95)' }} />
            <stop offset="0.35" style={{ stopColor: 'rgb(var(--c-muted) / 0.7)' }} />
            <stop offset="0.55" style={{ stopColor: 'rgb(var(--c-text) / 0.9)' }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--c-muted) / 0.35)' }} />
          </linearGradient>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'rgb(var(--c-text) / 0.35)' }} />
            <stop offset="0.5" style={{ stopColor: 'rgb(var(--c-text) / 0.02)' }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--c-primary) / 0.35)' }} />
          </linearGradient>
          <radialGradient id={`${id}-floor`} cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: 'rgb(0 0 0 / 0.55)' }} />
            <stop offset="1" style={{ stopColor: 'rgb(0 0 0 / 0)' }} />
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="520" rx="210" ry="26" fill={`url(#${id}-floor)`} />
        {plate ? (
          <g>
            <circle cx="300" cy="290" r="210" fill={`url(#${id}-rubber)`} stroke={`url(#${id}-rim)`} strokeWidth="2" />
            <circle cx="300" cy="290" r="176" fill="none" style={{ stroke: 'rgb(var(--c-text) / 0.07)' }} strokeWidth="10" />
            <circle cx="300" cy="290" r="150" fill="none" style={{ stroke: 'rgb(var(--c-text) / 0.05)' }} strokeWidth="1.5" />
            <circle cx="300" cy="290" r="124" fill="none" style={{ stroke: 'rgb(var(--c-primary) / 0.55)' }} strokeWidth="1.2" />
            <circle cx="300" cy="290" r="96" fill="none" style={{ stroke: 'rgb(var(--c-text) / 0.06)' }} strokeWidth="1.5" />
            <circle cx="300" cy="290" r="62" fill={`url(#${id}-chrome)`} />
            <circle cx="300" cy="290" r="50" fill="none" style={{ stroke: 'rgb(var(--c-background) / 0.6)' }} strokeWidth="3" />
            <circle cx="300" cy="290" r="30" style={{ fill: 'rgb(var(--c-background))' }} />
            <path d="M150 170 A 200 200 0 0 1 300 92" fill="none" style={{ stroke: 'rgb(var(--c-text) / 0.28)' }} strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g transform="translate(0 30)">
            <rect x="214" y="268" width="172" height="26" rx="6" fill={`url(#${id}-chrome)`} />
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={i} x1={234 + i * 8.5} y1="270" x2={230 + i * 8.5} y2="292" style={{ stroke: 'rgb(var(--c-background) / 0.35)' }} strokeWidth="1" />
            ))}
            {[120, 386].map((x) => (
              <g key={x}>
                <path d={`M${x} 196 l94 0 l0 0 l0 170 l-94 0 z`} fill="none" />
                <polygon points={`${x + 6},175 ${x + 88},175 ${x + 94},281 ${x + 88},387 ${x + 6},387 ${x},281`} fill={`url(#${id}-rubber)`} stroke={`url(#${id}-rim)`} strokeWidth="1.5" />
                <rect x={x + 30} y="250" width="34" height="62" rx="4" fill={`url(#${id}-chrome)`} opacity="0.7" />
              </g>
            ))}
            <rect x="204" y="258" width="12" height="46" rx="3" fill={`url(#${id}-chrome)`} />
            <rect x="384" y="258" width="12" height="46" rx="3" fill={`url(#${id}-chrome)`} />
          </g>
        )}
      </svg>
    </div>
  );
}
