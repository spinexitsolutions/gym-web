import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedProfile, seg, useMaterials } from '../materials';
import { useQuality } from '../context';
import { WeightPlate, type WeightPlateProps } from './WeightPlate';

/**
 * 20 kg Olympic barbell (2.2 m, Ø28 mm shaft, Ø50 mm sleeves), authored in metres along the X axis.
 * Knurled grip zones use the knurl material (procedural bump map); sleeves are brushed steel with
 * chrome flanges. Optional plates are loaded from the inner flange outwards and locked with collars.
 */
export interface BarbellProps {
  plates?: Pick<WeightPlateProps, 'radius' | 'thickness' | 'variant' | 'accent'>[];
  collars?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const SHAFT_R = 0.014;
const SLEEVE_R = 0.025;
const SHAFT_HALF = 0.655;
const FLANGE_W = 0.03;
const SLEEVE_END = 1.1;

/** [startX, endX, knurled] along the shaft. */
const SHAFT_ZONES: [number, number, boolean][] = [
  [-SHAFT_HALF, -0.62, false],
  [-0.62, -0.46, true],
  [-0.46, -0.45, false], // IWF knurl mark
  [-0.45, -0.215, true],
  [-0.215, -0.08, false],
  [-0.08, 0.08, true],
  [0.08, 0.215, false],
  [0.215, 0.45, true],
  [0.45, 0.46, false],
  [0.46, 0.62, true],
  [0.62, SHAFT_HALF, false],
];

const FLANGE_PROFILE: [number, number][] = [
  [0.036, 0],
  [0.036, 0.012],
  [0.03, 0.015],
  [0.014, 0.015],
  [0.014, -0.015],
  [0.03, -0.015],
  [0.036, -0.012],
  [0.036, 0],
];

export function Barbell({ plates = [], collars = true, position, rotation }: BarbellProps) {
  const m = useMaterials();
  const q = useQuality();
  const radial = seg(q, 32);
  const geos = useMemo(() => {
    const cyl = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, radial, 1).rotateZ(Math.PI / 2);
    return {
      zones: SHAFT_ZONES.map(([a, b, k]) => ({ geo: cyl(SHAFT_R, b - a), x: (a + b) / 2, knurl: k })),
      flange: new THREE.LatheGeometry(roundedProfile(FLANGE_PROFILE, 0.003, 3), radial).rotateZ(Math.PI / 2),
      sleeve: cyl(SLEEVE_R, SLEEVE_END - SHAFT_HALF - FLANGE_W),
      sleeveCap: cyl(SLEEVE_R + 0.0015, 0.012),
      groove: new THREE.TorusGeometry(SLEEVE_R + 0.0003, 0.0012, 6, radial).rotateY(Math.PI / 2),
      bushing: new THREE.TorusGeometry(SLEEVE_R + 0.0005, 0.0028, 10, radial).rotateY(Math.PI / 2),
      collar: cyl(0.04, 0.045),
      collarRing: cyl(0.042, 0.008),
    };
  }, [radial]);

  const sleeveStart = SHAFT_HALF + FLANGE_W;
  const sleeveLen = SLEEVE_END - sleeveStart;

  // Plate stacking positions on one sleeve (mirrored on the other).
  const loaded = useMemo(() => {
    let x = sleeveStart + 0.004;
    const out: { x: number; p: (typeof plates)[number] }[] = [];
    for (const p of plates) {
      const t = p.thickness ?? (p.variant === 'steel' ? 0.032 : 0.066);
      out.push({ x: x + t / 2, p });
      x += t + 0.002;
    }
    return { list: out, end: x };
  }, [plates, sleeveStart]);

  return (
    <group position={position} rotation={rotation}>
      {geos.zones.map((z, i) => (
        <mesh key={i} geometry={z.geo} material={z.knurl ? m.knurl : m.chrome} position={[z.x, 0, 0]} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <mesh geometry={geos.flange} material={m.chrome} position={[SHAFT_HALF + FLANGE_W / 2, 0, 0]} />
          <mesh geometry={geos.sleeve} material={m.steel} position={[sleeveStart + sleeveLen / 2, 0, 0]} />
          <mesh geometry={geos.sleeveCap} material={m.chrome} position={[SLEEVE_END - 0.006, 0, 0]} />
          <mesh geometry={geos.bushing} material={m.bronze} position={[sleeveStart + 0.004, 0, 0]} />
          {[0.025, 0.05, 0.075, 0.1, 0.125].map((d) => (
            <mesh key={d} geometry={geos.groove} material={m.chrome} position={[SLEEVE_END - d, 0, 0]} />
          ))}
          {loaded.list.map(({ x, p }, i) => (
            // Plates face outward: accent ring on the outer face only.
            <group key={i} scale={[1, 1, side]}>
              <WeightPlate {...p} position={[x, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
            </group>
          ))}
          {collars && plates.length > 0 && (
            <group position={[loaded.end + 0.024, 0, 0]}>
              <mesh geometry={geos.collar} material={m.frame} />
              <mesh geometry={geos.collarRing} material={m.chrome} position={[0.02, 0, 0]} />
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
