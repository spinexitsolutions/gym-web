import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Img } from '../ui/Img.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { useInView } from '../../hooks/useInView.js';
import { posterUrl } from '../../utils/media.js';
import { webglAvailable } from '../../utils/webgl.js';

const HeroDumbbell = lazy(() => import('../three/HeroDumbbell.jsx'));

function use3d(enabled) {
  const reduced = useReducedMotion();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!enabled || reduced) return setOk(false);
    const mq = window.matchMedia('(min-width: 1024px)');
    const lowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    const check = () => setOk(mq.matches && !lowPower && webglAvailable());
    check();
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, [enabled, reduced]);
  return ok;
}

export function Hero({ hero, accent }) {
  const reduced = useReducedMotion();
  const show3d = use3d(hero.show3d);
  const [ref, inView] = useInView({ once: false });
  const video = hero.backgroundVideo?.url;
  const fade = (delay) => (reduced ? {} : { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] } });

  return (
    <section ref={ref} className="relative -mt-[72px] flex min-h-[100svh] items-center overflow-hidden pt-[72px]" aria-label="Introduction">
      <div className="absolute inset-0 -z-10">
        {video && !reduced ? (
          <video className="h-full w-full object-cover" src={video} poster={posterUrl(hero.backgroundImage?.url)} autoPlay muted loop playsInline preload="metadata" aria-hidden />
        ) : (
          <Img image={hero.backgroundImage} priority decorative sizes="100vw" className="h-full w-full scale-105" />
        )}
        <div className="absolute inset-0 bg-[#0B0B0C]" style={{ opacity: hero.overlayOpacity }} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-[#0B0B0C]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0C]/80 via-[#0B0B0C]/20 to-transparent" />
      </div>

      <div className="container grid items-center gap-10 py-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="max-w-3xl text-[#F4F1EA]">
          <motion.p {...fade(0.05)} className="eyebrow mb-6 flex items-center gap-3">
            <span className="h-px w-10 bg-gold" aria-hidden />{hero.eyebrow}
          </motion.p>
          <motion.h1 {...fade(0.15)} className="text-balance text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-[5.25rem]">
            {hero.title}{' '}
            {hero.highlight && <em className="text-gold-metal not-italic">{hero.highlight}</em>}
          </motion.h1>
          <motion.p {...fade(0.3)} className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-[#F4F1EA]/75 md:text-lg">
            {hero.subtitle}
          </motion.p>
          <motion.div {...fade(0.45)} className="mt-10 flex flex-col gap-3 sm:flex-row">
            {hero.primaryCta?.label && (
              <Button to={hero.primaryCta.href} size="lg">{hero.primaryCta.label} <ArrowRight className="h-4 w-4" aria-hidden /></Button>
            )}
            {hero.secondaryCta?.label && (
              <Button to={hero.secondaryCta.href} size="lg" variant="outline" className="text-[#F4F1EA]">{hero.secondaryCta.label}</Button>
            )}
          </motion.div>
        </div>

        <div className="relative hidden h-[520px] lg:block">
          {show3d && (
            <Suspense fallback={null}>
              <HeroDumbbell accent={accent} paused={!inView} />
            </Suspense>
          )}
        </div>
      </div>

      <a href="#stats" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.65rem] uppercase tracking-eyebrow text-[#F4F1EA]/60 transition hover:text-gold md:flex">
        Scroll <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden />
      </a>
    </section>
  );
}
