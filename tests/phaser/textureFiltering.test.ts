import { describe, expect, it, vi } from 'vitest';
import { applyNearestTextureFilter } from '../../src/phaser/textureFiltering';

describe('applyNearestTextureFilter', () => {
  it('sets the filter mode to nearest when the texture exists', () => {
    const setFilter = vi.fn();
    applyNearestTextureFilter({
      exists: () => true,
      get: () => ({ setFilter }),
    }, 'ship');

    expect(setFilter).toHaveBeenCalledWith(1);
  });

  it('does nothing when the texture key does not exist', () => {
    const setFilter = vi.fn();
    applyNearestTextureFilter({
      exists: () => false,
      get: () => ({ setFilter }),
    }, 'missing');

    expect(setFilter).not.toHaveBeenCalled();
  });
});
