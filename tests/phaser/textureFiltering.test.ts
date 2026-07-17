import { describe, expect, it, vi } from 'vitest';
import { applyProjectCanvasRenderMode, applyProjectTextureFilter } from '../../src/phaser/textureFiltering';

describe('applyProjectTextureFilter', () => {
  it('sets the filter mode to nearest for pixel-art projects', () => {
    const setFilter = vi.fn();
    applyProjectTextureFilter({
      exists: () => true,
      get: () => ({ setFilter }),
    }, 'ship', 'pixel-art');

    expect(setFilter).toHaveBeenCalledWith(1);
  });

  it('keeps nearest filtering independent from sprite tinting', () => {
    const texture = { setFilter: vi.fn(), tint: 0x224466 };
    applyProjectTextureFilter({
      exists: () => true,
      get: () => texture,
    }, 'tinted-star', 'pixel-art');

    expect(texture.setFilter).toHaveBeenCalledWith(1);
    expect(texture.tint).toBe(0x224466);
  });

  it('sets the filter mode to linear for smooth-2d projects', () => {
    const setFilter = vi.fn();
    applyProjectTextureFilter({
      exists: () => true,
      get: () => ({ setFilter }),
    }, 'ship', 'smooth-2d');

    expect(setFilter).toHaveBeenCalledWith(0);
  });

  it('does nothing when the texture key does not exist', () => {
    const setFilter = vi.fn();
    applyProjectTextureFilter({
      exists: () => false,
      get: () => ({ setFilter }),
    }, 'missing', 'pixel-art');

    expect(setFilter).not.toHaveBeenCalled();
  });

  it('uses browser smoothing and subpixel camera placement for smooth-2d projects', () => {
    const canvas = { style: { imageRendering: 'pixelated' } };
    const camera = { roundPixels: true };

    applyProjectCanvasRenderMode(canvas, camera, 'smooth-2d');

    expect(canvas.style.imageRendering).toBe('auto');
    expect(camera.roundPixels).toBe(false);
  });

  it('uses pixelated canvas scaling and rounded camera positions for pixel-art projects', () => {
    const canvas = { style: { imageRendering: 'auto' } };
    const camera = { roundPixels: false };

    applyProjectCanvasRenderMode(canvas, camera, 'pixel-art');

    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(camera.roundPixels).toBe(true);
  });
});
