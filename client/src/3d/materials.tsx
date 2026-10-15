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

/** Procedural knurling: a diamond cross-hatch drawn on a canvas, used as a bump map. */
function makeKnurlTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const step = 16;
  ctx.lineWidth = 3;
  for (let i = -size; i < size * 2; i += step) {
    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d0d0d0';
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i + 3, 0);
    ctx.lineTo(i + 3 + size, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 22);
  tex.anisotropy = 4;
  return tex;
}

/** Fine radial "brushed" streaks for steel hubs and sleeves. */
function makeBrushedTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 16;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < w; x++) {
    const v = 150 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
}

function createMaterials(quality: QualitySettings, accent: THREE.Color): Materials {
  const knurlTex = quality.detail ? makeKnurlTexture() : null;
  const brushed = quality.detail ? makeBrushedTexture() : null;
  return {
    chrome: new THREE.MeshPhysicalMaterial({ color: '#f2f4f7', metalness: 1, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.25 }),
    knurl: new THREE.MeshPhysicalMaterial({
      color: '#d9dde2',
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.1,
      ...(knurlTex ? { bumpMap: knurlTex, bumpScale: 2.5, roughnessMap: knurlTex } : {}),
    }),
    steel: new THREE.MeshPhysicalMaterial({ color: '#b8bdc4', metalness: 1, roughness: 0.32, anisotropy: quality.detail ? 0.6 : 0, envMapIntensity: 1.1, ...(brushed ? { roughnessMap: brushed } : {}) }),
    rubber: new THREE.MeshPhysicalMaterial({ color: '#141518', metalness: 0, roughness: 0.78, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color('#3a3d44'), clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.9 }),
    powder: new THREE.MeshPhysicalMaterial({ color: '#1d1f23', metalness: 0.35, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 1 }),
    frame: new THREE.MeshPhysicalMaterial({ color: '#202226', metalness: 0.55, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    leather: new THREE.MeshPhysicalMaterial({ color: '#16171a', metalness: 0, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#4a4d55'), clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.35, toneMapped: false }),
  };
}

const MaterialsContext = createContext<Materials | null>(null);

export function MaterialsProvider({ quality, children }: { quality: QualitySettings; children: ReactNode }) {
  const accent = useThemeColor('--c-primary');
  const mats = useMemo(() => createMaterials(quality, new THREE.Color('#c6ff3d')), [quality]);
  useEffect(() => {
    mats.accent.color.copy(accent);
    mats.accent.emissive.copy(accent);
  }, [accent, mats]);
  useEffect(
    () => () => {
      for (const m of Object.values(mats) as THREE.Material[]) {
        const tex = m as THREE.MeshPhysicalMaterial;
        tex.bumpMap?.dispose();
        tex.roughnessMap?.dispose();
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
