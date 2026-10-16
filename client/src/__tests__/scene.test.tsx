import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultScene } from '@apex/shared';
import { SceneCanvas } from '@/3d/SceneCanvas';
import { detectQuality, hasWebGL } from '@/3d/quality';

describe('3D fallback', () => {
  it('jsdom has no WebGL, so detection reports false', () => {
    expect(hasWebGL()).toBe(false);
  });

  it('renders the accessible static poster instead of a canvas when WebGL is unavailable', () => {
    const { container } = render(<SceneCanvas config={defaultScene({ modelId: 'dumbbell' })} label="Hex dumbbell, rotating" />);
    expect(screen.getByRole('img', { name: 'Hex dumbbell, rotating' })).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('uses the admin-provided fallback image when WebGL is unavailable', () => {
    render(<SceneCanvas config={defaultScene()} label="Hero" fallbackImageUrl="/uploads/public/hero/x.webp" fallbackImageAlt="Training floor" />);
    expect(screen.getByAltText('Training floor')).toHaveAttribute('src', '/uploads/public/hero/x.webp');
  });
});

describe('quality tiers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops to the low tier for data-saver users', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 16, deviceMemory: 16, connection: { saveData: true } });
    const q = detectQuality(false);
    expect(q.tier).toBe('low');
    expect(q.saveData).toBe(true);
    expect(q.shadows).toBe(false);
  });

  it('caps pixel ratio and keeps reduced-motion preference', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 4, deviceMemory: 4 });
    const q = detectQuality(true);
    expect(q.maxDpr).toBeLessThanOrEqual(2);
    expect(q.reducedMotion).toBe(true);
  });
});
