import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { QualitySettings } from './quality';

/** Reads an `R G B` channel CSS variable (as set by applyTheme) into a THREE.Color. */
export function cssVarColor(name: string, fallback = '#c6ff3d'): THREE.Color {
  const raw = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return new THREE.Color().setRGB(parts[0] / 255, parts[1] / 255, parts[2] / 255, THREE.SRGBColorSpace);
  }
  return new THREE.Color(fallback);
}

/** Theme colour that follows runtime theme changes (admin live preview re-applies CSS variables). */
export function useThemeColor(name: string, fallback?: string): THREE.Color {
  const [color, setColor] = useState(() => cssVarColor(name, fallback));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const next = cssVarColor(name, fallback);
      setColor((prev) => (prev.equals(next) ? prev : next));
    });
    obs.observe(el, { attributes: true, attributeFilter: ['style', 'data-mode'] });
    return () => obs.disconnect();
  }, [name, fallback]);
  return color;
}

/* ------------------------------------------------------------ generated textures */

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** Converts a greyscale height canvas into a tangent-space normal map (Sobel). */
function heightToNormal(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const { c, ctx } = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
  return c;
}

function tex(c: HTMLCanvasElement, repeat: [number, number], srgb = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Diamond knurl: a tileable height field of raised pyramids (two crossing helical cuts),
 * turned into a normal map plus a roughness map (peaks polished, valleys rough).
 */
function makeKnurl(size: number) {
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  const cells = 16;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = ((x + y) / size) * cells;
      const v = ((x - y + size) / size) * cells;
      const a = 1 - Math.abs((u % 1) - 0.5) * 2;
      const b = 1 - Math.abs((v % 1) - 0.5) * 2;
      const hgt = Math.min(a, b);
      const val = Math.round(Math.min(1, hgt * 1.4) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const normal = heightToNormal(c, 3.2);
  const { c: rc, ctx: rctx } = canvas(size);
  rctx.drawImage(c, 0, 0);
  rctx.globalCompositeOperation = 'difference';
  rctx.fillStyle = '#ffffff';
  rctx.fillRect(0, 0, size, size); // invert: valleys bright = rough
  rctx.globalCompositeOperation = 'source-over';
  rctx.fillStyle = 'rgba(70,70,70,0.55)';
  rctx.fillRect(0, 0, size, size);
  return { normal: tex(normal, [6, 18]), roughness: tex(rc, [6, 18]) };
}

/** EPDM rubber: near-black base with fine grey flecks, plus a micro-bump normal map. */
function makeRubber(size: number) {
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#17181b';
  ctx.fillRect(0, 0, size, size);
  const flecks = size * size * 0.012;
  for (let i = 0; i < flecks; i++) {
    const g = 60 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.35 + Math.random() * 0.4})`;
    const r = Math.random() < 0.85 ? 0.6 : 1.2;
    ctx.fillRect(Math.random() * size, Math.random() * size, r, r);
  }
  const { c: hc, ctx: hctx } = canvas(size);
  const img = hctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  hctx.putImageData(img, 0, 0);
  hctx.filter = 'blur(0.6px)';
  hctx.drawImage(hc, 0, 0);
  return { map: tex(c, [6, 1], true), normal: tex(heightToNormal(hc, 0.9), [6, 1]) };
}

/** Brushed steel: long streaks in one direction → stretched roughness variation. */
function makeBrushed(size: number) {
  const { c, ctx } = canvas(size, 32);
  for (let x = 0; x < size; x++) {
    const v = 120 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 32);
  }
  return tex(c, [1, 1]);
}

/**
 * Circular label decal (transparent) used on plate faces and dumbbell end caps: text set along
 * the top and bottom arcs plus a fine tick ring that reads like embossed lettering.
 */
export function makeLabelTexture(opts: { top: string; bottom?: string; color: string; size: number; textRadius: number; fontScale?: number; ticks?: boolean }) {
  const { size } = opts;
  const { c, ctx } = canvas(size);
  const cx = size / 2;
  const R = opts.textRadius * cx;
  const font = Math.round(size * 0.06 * (opts.fontScale ?? 1));
  ctx.font = `700 ${font}px "Space Grotesk", "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const arc = (text: string, top: boolean, color: string) => {
    ctx.fillStyle = color;
    const spacing = font * 0.92;
    const chars = text.split('');
    const total = chars.length * spacing;
    const angleSpan = total / R;
    chars.forEach((ch, i) => {
      const t = (i + 0.5) * spacing;
      const a = (top ? -Math.PI / 2 - angleSpan / 2 : Math.PI / 2 + angleSpan / 2) + (top ? 1 : -1) * (t / R);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * R, cx + Math.sin(a) * R);
      ctx.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  };
  arc(opts.top, true, opts.color);
  if (opts.bottom) arc(opts.bottom, false, 'rgba(210,214,220,0.55)');
  if (opts.ticks) {
    ctx.strokeStyle = 'rgba(210,214,220,0.22)';
    ctx.lineWidth = Math.max(1, size / 512);
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r1 = R + font * 0.95;
      const r2 = r1 + (i % 10 === 0 ? font * 0.5 : font * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cx + Math.sin(a) * r2);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface Materials {
  chrome: THREE.MeshPhysicalMaterial;
  knurl: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshPhysicalMaterial;
  powder: THREE.MeshPhysicalMaterial;
  frame: THREE.MeshPhysicalMaterial;
  leather: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshStandardMaterial;
  bronze: THREE.MeshPhysicalMaterial;
  darkSteel: THREE.MeshPhysicalMaterial;
  /** Transparent label decals in the theme primary colour. */
  plateLabel: THREE.MeshPhysicalMaterial;
  capLabel: THREE.MeshPhysicalMaterial;
}

function createMaterials(quality: QualitySettings, accent: THREE.Color): Materials {
  const size = quality.tier === 'low' ? 256 : quality.tier === 'medium' ? 512 : 1024;
  const knurl = quality.detail ? makeKnurl(Math.min(size, 512)) : null;
  const rubber = makeRubber(Math.min(size, 512));
  const brushed = makeBrushed(size);
  const accentHex = `#${accent.getHexString()}`;
  const plateLabel = makeLabelTexture({ top: '20 KG', bottom: 'OLYMPIC  BUMPER', color: accentHex, size, textRadius: 0.78, fontScale: 1.25, ticks: true });
  const capLabel = makeLabelTexture({ top: '22.5 KG', color: accentHex, size: Math.min(size, 512), textRadius: 0.72, fontScale: 1.6 });
  const decal = (map: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({ map, transparent: true, roughness: 0.55, metalness: 0, clearcoat: 0.2, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  return {
    chrome: new THREE.MeshPhysicalMaterial({ color: '#f4f6f8', metalness: 1, roughness: 0.14, clearcoat: 0.5, clearcoatRoughness: 0.08, envMapIntensity: 1.35 }),
    knurl: new THREE.MeshPhysicalMaterial({
      color: '#dfe2e6',
      metalness: 1,
      roughness: 0.32,
      envMapIntensity: 1.2,
      ...(knurl ? { normalMap: knurl.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: knurl.roughness } : {}),
    }),
    steel: new THREE.MeshPhysicalMaterial({ color: '#bfc4ca', metalness: 1, roughness: 0.3, anisotropy: 0.7, anisotropyRotation: Math.PI / 2, roughnessMap: brushed, envMapIntensity: 1.15 }),
    bronze: new THREE.MeshPhysicalMaterial({ color: '#b48a52', metalness: 1, roughness: 0.32, envMapIntensity: 1.1 }),
    rubber: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: rubber.map, normalMap: rubber.normal, normalScale: new THREE.Vector2(0.35, 0.35), metalness: 0, roughness: 0.85, clearcoat: 0.05, clearcoatRoughness: 0.7, sheen: 0.25, sheenRoughness: 0.9, sheenColor: new THREE.Color('#3a3d44'), envMapIntensity: 0.85 }),
    powder: new THREE.MeshPhysicalMaterial({ color: '#1c1e22', metalness: 0.25, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 1 }),
    frame: new THREE.MeshPhysicalMaterial({ color: '#202226', metalness: 0.55, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    leather: new THREE.MeshPhysicalMaterial({ color: '#16171a', metalness: 0, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#4a4d55'), clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    darkSteel: new THREE.MeshPhysicalMaterial({ color: '#2a2c30', metalness: 1, roughness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.35, toneMapped: false }),
    plateLabel: decal(plateLabel),
    capLabel: decal(capLabel),
  };
}

const MaterialsContext = createContext<Materials | null>(null);

export function MaterialsProvider({ quality, children }: { quality: QualitySettings; children: ReactNode }) {
  const accent = useThemeColor('--c-primary');
  const hex = accent.getHexString();
  // Rebuilt when the theme accent changes (labels are baked into textures).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mats = useMemo(() => createMaterials(quality, new THREE.Color(`#${hex}`)), [quality, hex]);
  useEffect(
    () => () => {
      for (const m of Object.values(mats) as THREE.MeshPhysicalMaterial[]) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap'] as const) m[k]?.dispose();
        m.dispose();
      }
    },
    [mats],
  );
  return <MaterialsContext.Provider value={mats}>{children}</MaterialsContext.Provider>;
}

export function useMaterials(): Materials {
  const m = useContext(MaterialsContext);
  if (!m) throw new Error('useMaterials must be used inside MaterialsProvider');
  return m;
}

/** Radial segments scaled by quality tier. */
export const seg = (quality: QualitySettings, n: number) => Math.max(8, Math.round(n * quality.segments));

/**
 * Rounds the corners of a 2D lathe profile so revolved shapes catch soft highlights
 * instead of looking CAD-sharp. `points` are [radius, height] pairs.
 */
export function roundedProfile(points: [number, number][], radius: number, steps = 4): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  const v = points.map(([x, y]) => new THREE.Vector2(x, y));
  v.forEach((p, i) => {
    if (i === 0 || i === v.length - 1) {
      out.push(p.clone());
      return;
    }
    const prev = v[i - 1];
    const next = v[i + 1];
    const d1 = prev.clone().sub(p);
    const d2 = next.clone().sub(p);
    const r = Math.min(radius, d1.length() / 2, d2.length() / 2);
    const a = p.clone().add(d1.normalize().multiplyScalar(r));
    const b = p.clone().add(d2.normalize().multiplyScalar(r));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Quadratic Bézier a → p → b
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * p.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * p.y + t * t * b.y;
      out.push(new THREE.Vector2(x, y));
    }
  });
  return out;
}
