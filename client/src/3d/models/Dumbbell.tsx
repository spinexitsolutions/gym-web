import { useMemo } from 'react';
import * as THREE from 'three';
import { seg, useMaterials } from '../materials';
import { useQuality } from '../context';

/**
 * Rubber hex dumbbell (~22.5 kg), authored in metres along the X axis.
 * Heads are bevelled hexagonal extrusions (flats top/bottom so it rests naturally),
 * the handle is knurled chrome with polished collars and chrome end emblems.
 */
const HEX_R = 0.085;
const HEAD_DEPTH = 0.1;
const HANDLE_HALF = 0.07;
const COLLAR_W = 0.012;

export function Dumbbell({ position, rotation, accent = false }: { position?: [number, number, number]; rotation?: [number, number, number]; accent?: boolean }) {
  const m = useMaterials();
  const q = useQuality();
  const radial = seg(q, 32);
  const geos = useMemo(() => {
    const bevel = 0.009;
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const r = HEX_R - bevel;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const depth = HEAD_DEPTH - bevel * 2;
    const head = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: q.detail ? 4 : 2, curveSegments: 1 });
    head.translate(0, 0, -depth / 2);
    head.rotateY(Math.PI / 2);
    head.computeVertexNormals();
    const cyl = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, radial, 1).rotateZ(Math.PI / 2);
    return {
      head,
      handle: cyl(0.0165, HANDLE_HALF * 2),
      collar: cyl(0.024, COLLAR_W),
      collarLip: new THREE.TorusGeometry(0.024, 0.0025, 8, radial).rotateY(Math.PI / 2),
      emblem: cyl(0.036, 0.004),
      emblemRing: new THREE.TorusGeometry(0.03, 0.0012, 6, radial).rotateY(Math.PI / 2),
      capLabel: new THREE.CircleGeometry(0.0335, radial).rotateY(Math.PI / 2),
      screw: new THREE.CylinderGeometry(0.0075, 0.0075, 0.003, 6).rotateZ(Math.PI / 2),
      screwHead: new THREE.CylinderGeometry(0.011, 0.011, 0.0025, radial).rotateZ(Math.PI / 2),
    };
  }, [radial, q.detail]);

  const headCenter = HANDLE_HALF + COLLAR_W + HEAD_DEPTH / 2;
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geos.handle} material={m.knurl} />
      {[-1, 1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <mesh geometry={geos.collar} material={m.chrome} position={[HANDLE_HALF + COLLAR_W / 2, 0, 0]} />
          <mesh geometry={geos.collarLip} material={m.chrome} position={[HANDLE_HALF + 0.001, 0, 0]} />
          <mesh geometry={geos.head} material={m.rubber} position={[headCenter, 0, 0]} />
          <mesh geometry={geos.emblem} material={m.chrome} position={[headCenter + HEAD_DEPTH / 2 + 0.001, 0, 0]} />
          <mesh geometry={geos.emblemRing} material={accent ? m.accent : m.steel} position={[headCenter + HEAD_DEPTH / 2 + 0.0035, 0, 0]} />
          <mesh geometry={geos.capLabel} material={m.capLabel} position={[headCenter + HEAD_DEPTH / 2 + 0.0032, 0, 0]} />
          <mesh geometry={geos.screwHead} material={m.chrome} position={[headCenter + HEAD_DEPTH / 2 + 0.0042, 0, 0]} />
          <mesh geometry={geos.screw} material={m.darkSteel} position={[headCenter + HEAD_DEPTH / 2 + 0.0052, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Distance from the bar axis to the floor when the dumbbell rests on a flat. */
export const DUMBBELL_REST_HEIGHT = HEX_R * Math.sin(Math.PI / 3);
