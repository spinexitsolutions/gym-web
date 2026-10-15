import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { seg, useMaterials } from '../materials';
import { useQuality } from '../context';

/**
 * Adjustable (FID) bench, authored in metres resting on y = 0, length along X.
 * Powder-coated frame, stitched-look upholstered pads (rounded boxes with sheen),
 * chrome pop-pin and rubber transport wheels. Backrest set to 28°.
 */
const BACK_ANGLE = (28 * Math.PI) / 180;

export function Bench({ position, rotation }: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const m = useMaterials();
  const q = useQuality();
  const smooth = q.detail ? 4 : 2;
  const geos = useMemo(
    () => ({
      wheel: new THREE.CylinderGeometry(0.042, 0.042, 0.032, seg(q, 24)).rotateX(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.018, 0.018, 0.036, seg(q, 16)).rotateX(Math.PI / 2),
      pin: new THREE.CylinderGeometry(0.008, 0.008, 0.11, seg(q, 12)).rotateX(Math.PI / 2),
      knob: new THREE.SphereGeometry(0.018, seg(q, 16), seg(q, 12)),
    }),
    [q],
  );
  const hinge: [number, number, number] = [-0.16, 0.44, 0];

  return (
    <group position={position} rotation={rotation}>
      {/* Base: spine rail, feet and uprights */}
      <RoundedBox args={[1.12, 0.06, 0.08]} radius={0.012} smoothness={smooth} position={[0, 0.2, 0]} material={m.frame} />
      <RoundedBox args={[0.08, 0.05, 0.52]} radius={0.012} smoothness={smooth} position={[-0.56, 0.025, 0]} material={m.frame} />
      <RoundedBox args={[0.08, 0.05, 0.46]} radius={0.012} smoothness={smooth} position={[0.54, 0.045, 0]} material={m.frame} />
      <RoundedBox args={[0.07, 0.16, 0.07]} radius={0.01} smoothness={smooth} position={[-0.52, 0.11, 0]} material={m.frame} />
      <RoundedBox args={[0.07, 0.14, 0.07]} radius={0.01} smoothness={smooth} position={[0.5, 0.12, 0]} material={m.frame} />
      {/* Rubber foot caps */}
      {[-0.24, 0.24].map((z) => (
        <RoundedBox key={z} args={[0.085, 0.012, 0.05]} radius={0.004} smoothness={2} position={[-0.56, 0.006, z]} material={m.rubber} />
      ))}
      {/* Transport wheels */}
      {[-0.245, 0.245].map((z) => (
        <group key={z} position={[0.56, 0.042, z]}>
          <mesh geometry={geos.wheel} material={m.rubber} />
          <mesh geometry={geos.hub} material={m.chrome} />
        </group>
      ))}
      {/* Seat post + seat pad */}
      <RoundedBox args={[0.06, 0.2, 0.06]} radius={0.01} smoothness={smooth} position={[-0.38, 0.31, 0]} material={m.frame} />
      <RoundedBox args={[0.36, 0.022, 0.2]} radius={0.006} smoothness={2} position={[-0.36, 0.413, 0]} material={m.frame} />
      <RoundedBox args={[0.4, 0.075, 0.29]} radius={0.03} smoothness={smooth} position={[-0.37, 0.46, 0]} material={m.leather} />
      {/* Adjustment ladder with chrome pins */}
      {[0.06, 0.13, 0.2, 0.27].map((x) => (
        <RoundedBox key={x} args={[0.03, 0.03, 0.1]} radius={0.006} smoothness={2} position={[x, 0.245, 0]} material={m.steel} />
      ))}
      {/* Back strut */}
      <RoundedBox args={[0.05, 0.36, 0.05]} radius={0.01} smoothness={smooth} position={[0.24, 0.41, 0]} rotation={[0, 0, -0.08]} material={m.frame} />
      <mesh geometry={geos.pin} material={m.chrome} position={[0.24, 0.27, 0]} />
      <mesh geometry={geos.knob} material={m.chrome} position={[0.24, 0.27, 0.065]} />
      {/* Backrest on hinge */}
      <group position={hinge} rotation={[0, 0, BACK_ANGLE]}>
        <RoundedBox args={[0.8, 0.022, 0.2]} radius={0.006} smoothness={2} position={[0.42, -0.03, 0]} material={m.frame} />
        <RoundedBox args={[0.84, 0.075, 0.29]} radius={0.03} smoothness={smooth} position={[0.43, 0.018, 0]} material={m.leather} />
        <mesh position={[0.43, 0.0562, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.accent}>
          <planeGeometry args={[0.76, 0.003]} />
        </mesh>
      </group>
    </group>
  );
}
