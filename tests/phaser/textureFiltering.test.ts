import { describe, expect, it, vi } from 'vitest';
import { applyProjectTextureFilter } from '../../src/phaser/textureFiltering';

describe('applyProjectTextureFilter', () => {
  it('sets the filter mode to nearest for pixel-art projects', () => {
    const setFilter = vi.fn();
    applyProjectTextureFilter({
      exists: () => true,
      get: () => ({ setFilter }),
    }, 'ship', 'pixel-art');

    expect(setFilter).toHaveBeenCalledWith(1);
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
});
