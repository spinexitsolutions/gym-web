import { useMemo } from 'react';
import * as THREE from 'three';
import { seg, useMaterials } from '../materials';
import { useQuality } from '../context';

/**
 * 24 kg competition kettlebell, authored in metres, resting on y = 0.
 * Body: smooth lathe from a spline profile (flat base, full belly, shoulder);
 * handle: a tube swept along a Catmull-Rom curve. Satin powder-coat finish.
 */
export function Kettlebell({ position, rotation, accent = false }: { position?: [number, number, number]; rotation?: [number, number, number]; accent?: boolean }) {
  const m = useMaterials();
  const q = useQuality();
  const radial = seg(q, 64);
  const geos = useMemo(() => {
    const curve = new THREE.SplineCurve(
      [
        [0.062, 0],
        [0.086, 0.006],
        [0.103, 0.035],
        [0.11, 0.08],
        [0.105, 0.126],
        [0.088, 0.163],
        [0.06, 0.187],
        [0.026, 0.197],
        [0.0005, 0.199],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const pts = [new THREE.Vector2(0.0005, 0), new THREE.Vector2(0.05, 0), ...curve.getPoints(q.detail ? 48 : 24)];
    const body = new THREE.LatheGeometry(pts, radial);
    const path = new THREE.CatmullRomCurve3(
      [
        [-0.06, 0.158],
        [-0.072, 0.2],
        [-0.07, 0.245],
        [-0.048, 0.276],
        [0, 0.288],
        [0.048, 0.276],
        [0.07, 0.245],
        [0.072, 0.2],
        [0.06, 0.158],
      ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'centripetal',
    );
    const handle = new THREE.TubeGeometry(path, q.detail ? 96 : 48, 0.0175, seg(q, 20), false);
    const horn = new THREE.CylinderGeometry(0.017, 0.026, 0.03, seg(q, 20));
    const band = new THREE.TorusGeometry(0.1095, 0.0012, 6, radial * 2).rotateX(Math.PI / 2);
    return { body, handle, horn, band };
  }, [radial, q]);

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geos.body} material={m.powder} />
      <mesh geometry={geos.handle} material={m.powder} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.horn} material={m.powder} position={[0.062 * s, 0.168, 0]} rotation={[0, 0, s * 0.18]} />
      ))}
      {accent && <mesh geometry={geos.band} material={m.accent} position={[0, 0.08, 0]} />}
    </group>
  );
}
