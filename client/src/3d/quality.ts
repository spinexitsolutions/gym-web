/**
 * Device capability + quality tier detection for the 3D layer.
 *
 * IMPORTANT: this file must NOT import three / @react-three/* — it is used by the
 * always-loaded `SceneCanvas` wrapper to decide whether to download the 3D chunk at all.
 */
import { useEffect, useMemo, useState, type RefObject } from 'react';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  /** Max device pixel ratio for the canvas (≤1.5 on phones). */
  maxDpr: number;
  antialias: boolean;
  /** Real-time shadow maps (self-shadowing between parts). */
  shadows: boolean;
  /** Baked contact shadow on the floor. */
  contactShadows: boolean;
  contactShadowResolution: number;
  /** Cube-map resolution for the procedural Lightformer environment. */
  envResolution: number;
  /** Fine surface detail (knurling bump maps, extra radial segments). */
  detail: boolean;
  /** Radial segment multiplier for lathe/cylinder geometry. */
  segments: number;
  reducedMotion: boolean;
  saveData: boolean;
}

type NavigatorExtras = Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };

const mq = (q: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

export function prefersReducedMotion(): boolean {
  return mq('(prefers-reduced-motion: reduce)');
}

/** Subscribes to the OS "reduce motion" preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export function detectQuality(reducedMotion = prefersReducedMotion()): QualitySettings {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as NavigatorExtras;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const saveData = Boolean(nav.connection?.saveData);
  const slowNet = /(^|-)2g$/.test(nav.connection?.effectiveType ?? '');
  const shortSide = typeof window !== 'undefined' ? Math.min(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight) : 1024;
  const coarse = mq('(pointer: coarse)');
  const mobile = coarse || shortSide < 600;

  let tier: QualityTier;
  if (saveData || slowNet || cores <= 2 || memory <= 2) tier = 'low';
  else if (mobile || cores < 8 || memory < 8 || shortSide < 900) tier = 'medium';
  else tier = 'high';
  // Very high-density phone screens are fill-rate bound: drop one tier.
  if (mobile && dpr >= 3 && cores <= 6) tier = 'low';

  const base: Record<QualityTier, Omit<QualitySettings, 'tier' | 'reducedMotion' | 'saveData'>> = {
    low: { maxDpr: 1.25, antialias: false, shadows: false, contactShadows: false, contactShadowResolution: 256, envResolution: 64, detail: false, segments: 0.6 },
    medium: { maxDpr: 1.5, antialias: true, shadows: false, contactShadows: true, contactShadowResolution: 512, envResolution: 128, detail: true, segments: 0.85 },
    high: { maxDpr: 2, antialias: true, shadows: true, contactShadows: true, contactShadowResolution: 1024, envResolution: 256, detail: true, segments: 1 },
  };
  const s = base[tier];
  return { tier, ...s, maxDpr: Math.min(s.maxDpr, mobile ? 1.5 : 2, Math.max(1, dpr)), reducedMotion, saveData };
}

/** Quality settings for this device; re-evaluated when the reduced-motion preference changes. */
export function useQualityTier(): QualitySettings {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => detectQuality(reduced), [reduced]);
}

let webglCache: boolean | null = null;
/** True when a WebGL context can be created. Cached; the probe context is released immediately. */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    webglCache = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/**
 * Tracks whether an element is on screen (`inView`) and whether it is close enough
 * to start loading (`near`, sticky once true).
 */
export function useViewport(ref: RefObject<Element>, preloadMargin = '300px') {
  const [inView, setInView] = useState(false);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      setNear(true);
      return;
    }
    const visible = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.01 });
    const pre = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          pre.disconnect();
        }
      },
      { rootMargin: preloadMargin },
    );
    visible.observe(el);
    pre.observe(el);
    return () => {
      visible.disconnect();
      pre.disconnect();
    };
  }, [ref, preloadMargin]);
  return { inView, near };
}

/** False while the tab is hidden, so render loops can pause. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
