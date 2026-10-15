import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedProfile, seg, useMaterials } from '../materials';
import { useQuality } from '../context';

/**
 * Olympic bumper plate, authored in metres (Ø450 mm, 66 mm thick) around the Y axis.
 * Rubber body is a rounded lathe profile with a recessed face, raised hub ring, raised outer rim
 * and fine raised "lettering" rings; a brushed-steel hub insert sits in the centre.
 */
const RUBBER_PROFILE: [number, number][] = [
  [0.225, 0],
  [0.225, 0.033],
  [0.189, 0.033],
  [0.183, 0.024],
  [0.163, 0.024],
  [0.161, 0.0262],
  [0.158, 0.024],
  [0.131, 0.024],
  [0.129, 0.0262],
  [0.126, 0.024],
  [0.096, 0.024],
  [0.09, 0.03],
  [0.076, 0.03],
  [0.07, 0.022],
  [0.06, 0.022],
  [0.06, -0.022],
  [0.07, -0.022],
  [0.076, -0.03],
  [0.09, -0.03],
  [0.096, -0.024],
  [0.126, -0.024],
  [0.129, -0.0262],
  [0.131, -0.024],
  [0.158, -0.024],
  [0.161, -0.0262],
  [0.163, -0.024],
  [0.183, -0.024],
  [0.189, -0.033],
  [0.225, -0.033],
  [0.225, 0],
];

const HUB_PROFILE: [number, number][] = [
  [0.062, 0],
  [0.062, 0.021],
  [0.072, 0.021],
  [0.072, 0.0265],
  [0.0255, 0.0265],
  [0.0255, -0.0265],
  [0.072, -0.0265],
  [0.072, -0.021],
  [0.062, -0.021],
  [0.062, 0],
];

const STEEL_PROFILE: [number, number][] = [
  [0.16, 0],
  [0.16, 0.015],
  [0.15, 0.015],
  [0.146, 0.011],
  [0.07, 0.011],
  [0.066, 0.016],
  [0.0255, 0.016],
  [0.0255, -0.016],
  [0.066, -0.016],
  [0.07, -0.011],
  [0.146, -0.011],
  [0.15, -0.015],
  [0.16, -0.015],
  [0.16, 0],
];

export interface WeightPlateProps {
  /** Outer radius in metres (default 0.225). */
  radius?: number;
  /** Thickness in metres (default 0.066 for bumpers). */
  thickness?: number;
  /** `bumper` = black rubber with steel hub; `steel` = calibrated steel change plate. */
  variant?: 'bumper' | 'steel';
  /** Thin accent ring on the outer face (theme primary colour). */
  accent?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export function WeightPlate({ radius, thickness, variant = 'bumper', accent = false, position, rotation }: WeightPlateProps) {
  const m = useMaterials();
  const q = useQuality();
  const radial = seg(q, 72);
  const geo = useMemo(() => {
    if (variant === 'steel') return { body: new THREE.LatheGeometry(roundedProfile(STEEL_PROFILE, 0.002), radial), hub: null };
    return {
      body: new THREE.LatheGeometry(roundedProfile(RUBBER_PROFILE, q.detail ? 0.004 : 0.003, q.detail ? 4 : 2), radial),
      hub: new THREE.LatheGeometry(roundedProfile(HUB_PROFILE, 0.0015, 2), radial),
    };
  }, [variant, radial, q.detail]);
  const ring = useMemo(() => new THREE.TorusGeometry(0.144, 0.0011, 6, radial * 2), [radial]);

  const base = variant === 'steel' ? 0.16 : 0.225;
  const baseT = variant === 'steel' ? 0.032 : 0.066;
  const s = (radius ?? base) / base;
  const t = (thickness ?? baseT) / baseT;

  return (
    <group position={position} rotation={rotation}>
      <group scale={[s, t, s]}>
        <mesh geometry={geo.body} material={variant === 'steel' ? m.chrome : m.rubber} />
        {geo.hub && <mesh geometry={geo.hub} material={m.steel} />}
        {accent && variant === 'bumper' && <mesh geometry={ring} material={m.accent} position={[0, 0.0242, 0]} rotation={[Math.PI / 2, 0, 0]} />}
      </group>
    </group>
  );
}
