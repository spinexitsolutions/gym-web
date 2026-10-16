import { Environment, Lightformer } from '@react-three/drei';
import type { SceneConfig } from '@apex/shared';
import type { QualitySettings } from './quality';
import { useThemeColor } from './materials';

/**
 * Studio lighting built entirely from in-scene Lightformers rendered into a cube map once
 * (`frames={1}`): no HDR files are downloaded. Presets map to SceneConfig.environment.
 */
const PRESETS = {
  studio: { ambient: 0.18, key: 1.6, keyColor: '#ffffff', rim: 2.2, rimColor: '#dfe8ff', top: 2.4, topColor: '#ffffff', strips: 3.2, stripColor: '#ffffff', fill: 0.5, accent: 0.9 },
  night: { ambient: 0.08, key: 0.9, keyColor: '#cfd8ff', rim: 3.2, rimColor: '#8fb2ff', top: 1.2, topColor: '#c9d6ff', strips: 2.4, stripColor: '#b9caff', fill: 0.2, accent: 1.6 },
  warm: { ambient: 0.2, key: 1.7, keyColor: '#ffe2bf', rim: 1.8, rimColor: '#ffd3a0', top: 2.2, topColor: '#fff0dc', strips: 2.6, stripColor: '#ffe6c8', fill: 0.6, accent: 0.7 },
} as const;

export function Lighting({ environment, quality }: { environment: SceneConfig['environment']; quality: QualitySettings }) {
  const p = PRESETS[environment] ?? PRESETS.studio;
  const accent = useThemeColor('--c-primary');
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={p.key}
        color={p.keyColor}
        castShadow={quality.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-5, 2.5, -4]} intensity={p.rim} color={p.rimColor} />
      {/* Keyed by accent so a live theme change re-bakes the reflections. */}
      <Environment key={accent.getHexString()} resolution={quality.envResolution} frames={1}>
        {/* Overhead softbox */}
        <Lightformer form="rect" intensity={p.top} color={p.topColor} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 5, 1]} />
        {/* Tall strip lights — the long highlights on chrome */}
        <Lightformer form="rect" intensity={p.strips} color={p.stripColor} position={[-5, 1.5, 1.5]} rotation-y={Math.PI / 2} scale={[10, 0.6, 1]} />
        <Lightformer form="rect" intensity={p.strips * 0.8} color={p.stripColor} position={[5, 1.2, -1]} rotation-y={-Math.PI / 2} scale={[10, 0.45, 1]} />
        <Lightformer form="rect" intensity={p.strips * 0.5} color={p.stripColor} position={[0, 2.5, 6]} scale={[6, 0.35, 1]} />
        {/* Low front fill so rubber reads as rubber, not a black hole */}
        <Lightformer form="rect" intensity={p.fill} color="#ffffff" position={[0, -1.5, 5]} scale={[12, 3, 1]} />
        {/* Warm / cool rims from behind: the thin bright edges on chrome and plate lips */}
        <Lightformer form="rect" intensity={p.strips * 0.9} color="#ffe9d2" position={[-3.5, 1.5, -5]} rotation-y={Math.PI / 5} scale={[4, 0.25, 1]} />
        <Lightformer form="rect" intensity={p.strips * 0.9} color="#d6e4ff" position={[3.5, 0.8, -5]} rotation-y={-Math.PI / 5} scale={[4, 0.25, 1]} />
        {/* Faint accent kicker behind — a hint of the brand colour in reflections */}
        <Lightformer form="ring" intensity={p.accent} color={accent} position={[3, 1, -7]} scale={3.5} />
      </Environment>
    </>
  );
}
