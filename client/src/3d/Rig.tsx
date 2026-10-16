import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneConfig } from '@apex/shared';
import type { ModelDef } from './models/registry';

gsap.registerPlugin(ScrollTrigger);

const DEG = Math.PI / 180;
const MAX_YAW_TILT = 0.28;
const MAX_PITCH_TILT = 0.12;

interface RigProps {
  config: SceneConfig;
  motion: ModelDef['motion'];
  baseRotation: ModelDef['baseRotation'];
  reducedMotion: boolean;
  scrollTarget?: RefObject<HTMLElement>;
  children: ReactNode;
}

/**
 * Motion for the model stage:
 *  - auto-rotate (spin) or sway, scaled by animationSpeed,
 *  - pointer parallax (fine pointers) with clamped angles,
 *  - horizontal drag to turn the model (touch-friendly; vertical swipes still scroll the page,
 *    the wheel is never captured, so there is no zoom hijacking),
 *  - GSAP ScrollTrigger scrubbed rotation/drop tied to the scroll target's progress.
 * Reduced motion disables auto-rotate, parallax easing and scroll animation.
 */
export function Rig({ config, motion, baseRotation, reducedMotion, scrollTarget, children }: RigProps) {
  const outer = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const state = useRef({ yaw: 0, clock: 0, vel: 0, px: 0, py: 0, dragging: false, lastX: 0 });
  const scroll = useRef({ p: 0 });
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const auto = config.autoRotate && !reducedMotion && config.animationSpeed > 0;
  const interactive = config.interactive;

  // Pointer parallax (mouse only) — follows the cursor anywhere on the page, subtly.
  useEffect(() => {
    if (!interactive || reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      state.current.px = (e.clientX / window.innerWidth) * 2 - 1;
      state.current.py = (e.clientY / window.innerHeight) * 2 - 1;
      invalidate();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [interactive, reducedMotion, invalidate]);

  // Horizontal drag to rotate. `touch-action: pan-y` on the canvas keeps vertical page scroll.
  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    el.style.touchAction = 'pan-y';
    el.style.cursor = 'grab';
    const s = state.current;
    const down = (e: PointerEvent) => {
      s.dragging = true;
      s.lastX = e.clientX;
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      s.lastX = e.clientX;
      s.yaw += dx * 0.008;
      s.vel = dx * 0.004;
      invalidate();
    };
    const up = () => {
      s.dragging = false;
      el.style.cursor = 'grab';
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, interactive, invalidate]);

  // Scroll-scrubbed progress (0 → 1 while the target scrolls out of view).
  useEffect(() => {
    const target = scrollTarget?.current;
    if (!config.scrollAnimation || reducedMotion || !target) return;
    const obj = scroll.current;
    const tween = gsap.to(obj, {
      p: 1,
      ease: 'none',
      onUpdate: () => invalidate(),
      scrollTrigger: { trigger: target, start: 'top top', end: 'bottom top', scrub: 0.8 },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      obj.p = 0;
    };
  }, [config.scrollAnimation, reducedMotion, scrollTarget, invalidate]);

  useFrame((frame, dt) => {
    const d = Math.min(dt, 1 / 20);
    const s = state.current;
    if (!outer.current || !turn.current) return;
    let moving = false;
    if (auto) {
      if (motion === 'spin') s.yaw += d * 0.32 * config.animationSpeed;
      else s.clock += d * config.animationSpeed;
    }
    if (!s.dragging && Math.abs(s.vel) > 1e-4) {
      s.yaw += s.vel;
      s.vel *= 0.92;
      moving = true;
    }
    const sway = motion === 'sway' && auto ? Math.sin(s.clock * 0.42) * 0.26 : 0;
    const p = scroll.current.p;
    turn.current.rotation.y = baseRotation[1] + s.yaw + sway + p * 1.2;

    const parallax = interactive && !reducedMotion;
    const tx = baseRotation[0] + (parallax ? THREE.MathUtils.clamp(s.py, -1, 1) * MAX_PITCH_TILT : 0) + p * 0.35;
    const ty = parallax ? THREE.MathUtils.clamp(s.px, -1, 1) * MAX_YAW_TILT : 0;
    // Idle float: a slow, small bob so the object feels suspended rather than parked.
    const float = auto ? Math.sin(s.clock * 0.9) * 0.035 : 0;
    if (auto && motion === 'spin') s.clock += d * config.animationSpeed;
    const ny = config.position[1] - p * 0.6 + float;
    const o = outer.current;
    o.rotation.x = reducedMotion ? tx : THREE.MathUtils.damp(o.rotation.x, tx, 4, d);
    o.rotation.y = reducedMotion ? ty : THREE.MathUtils.damp(o.rotation.y, ty, 4, d);
    o.position.y = reducedMotion ? ny : THREE.MathUtils.damp(o.position.y, ny, 6, d);
    if (Math.abs(o.rotation.x - tx) > 1e-4 || Math.abs(o.rotation.y - ty) > 1e-4 || Math.abs(o.position.y - ny) > 1e-4) moving = true;
    if (moving && frame.frameloop !== 'always') invalidate();
  });

  const r = config.rotation;
  return (
    <group ref={outer} position={[config.position[0], config.position[1], config.position[2]]} scale={config.scale}>
      <group rotation={[r[0] * DEG, r[1] * DEG, r[2] * DEG]}>
        <group ref={turn}>{children}</group>
      </group>
    </group>
  );
}
