import { useEffect, useRef, useState } from 'react';
import { useSite } from '@/app/SiteProvider';

const INTERACTIVE = 'a[href], button:not([disabled]), [role="button"], [role="tab"], summary, select, [data-cursor="hover"]';

/**
 * Subtle ring cursor that eases after the pointer and grows over interactive elements.
 * Only for fine pointers, when enabled in the theme and the visitor doesn't prefer reduced motion.
 */
export function CustomCursor() {
  const { site } = useSite();
  const enabled = Boolean(site?.theme.effects.customCursor);
  const [supported, setSupported] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSupported(fine.matches && !reduced.matches);
    update();
    fine.addEventListener?.('change', update);
    reduced.addEventListener?.('change', update);
    return () => {
      fine.removeEventListener?.('change', update);
      reduced.removeEventListener?.('change', update);
    };
  }, []);

  const active = enabled && supported;

  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.classList.add('has-custom-cursor');
    let x = -100;
    let y = -100;
    let rx = -100;
    let ry = -100;
    let raf = 0;
    let visible = false;
    const show = (v: boolean) => {
      visible = v;
      if (ring.current) ring.current.style.opacity = v ? '1' : '0';
      if (dot.current) dot.current.style.opacity = v ? '1' : '0';
    };
    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        rx = x;
        ry = y;
        show(true);
      }
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (ring.current) ring.current.dataset.hover = String(Boolean(t?.closest?.(INTERACTIVE)));
    };
    const onDown = () => ring.current && (ring.current.dataset.down = 'true');
    const onUp = () => ring.current && (ring.current.dataset.down = 'false');
    const onLeave = () => show(false);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      html.classList.remove('has-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <div ref={ring} aria-hidden className="apex-cursor" style={{ opacity: 0 }} />
      <div ref={dot} aria-hidden className="apex-cursor-dot" style={{ opacity: 0 }} />
    </>
  );
}
