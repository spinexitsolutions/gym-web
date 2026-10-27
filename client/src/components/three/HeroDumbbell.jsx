// Procedural 3D dumbbell rendered with React Three Fiber. Loaded lazily, only on capable desktop devices.
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Dumbbell({ accent }) {
  const group = useRef();
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: accent, metalness: 1, roughness: 0.22 }), [accent]);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9b9bd', metalness: 1, roughness: 0.35 }), []);
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.2, roughness: 0.65 }), []);
  // Knurled grip: thin rings along the handle.
  const rings = useMemo(() => Array.from({ length: 14 }, (_, i) => -0.9 + i * (1.8 / 13)), []);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.25;
    // Gentle parallax toward the pointer.
    const { x, y } = state.pointer;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.35 + y * 0.15, 0.05);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0.35 + x * 0.1, 0.05);
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
  });

  const head = (side) => (
    <group position={[side * 1.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh material={rubber} castShadow>
        <cylinderGeometry args={[0.72, 0.72, 0.62, 6]} />
      </mesh>
      <mesh material={gold} position={[0, side * -0.33, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 6]} />
      </mesh>
      <mesh material={gold} position={[0, side * 0.33, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 6]} />
      </mesh>
    </group>
  );

  return (
    <group ref={group} rotation={[-0.35, 0, 0.35]}>
      <mesh material={steel} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 2.3, 32]} />
      </mesh>
      {rings.map((x) => (
        <mesh key={x} material={gold} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.135, 0.012, 8, 32]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={gold} position={[s * 1.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 32]} />
        </mesh>
      ))}
      {head(-1)}
      {head(1)}
    </group>
  );
}

export default function HeroDumbbell({ accent = '#C9A54C', paused = false }) {
  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.3, 5.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 5, 3]} intensity={2.2} color="#fff4dc" />
      <directionalLight position={[-5, -2, -3]} intensity={0.8} color="#7f8cff" />
      <pointLight position={[0, 2.5, 2.5]} intensity={18} color={accent} distance={8} />
      <pointLight position={[-3, -1, 2]} intensity={6} color="#ffffff" distance={8} />
      <Dumbbell accent={accent} />
    </Canvas>
  );
}

