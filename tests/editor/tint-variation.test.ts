import { describe, expect, it } from 'vitest';
import { buildGroupTintVariation } from '../../src/editor/tintVariation';
import { sampleScene } from '../../src/model/sampleScene';

describe('tint variation', () => {
  it('builds deterministic per-member RGB tints', () => {
    const options = {
      scope: 'all' as const,
      seed: 'stars-variation',
      minR: 20,
      maxR: 255,
      minG: 20,
      maxG: 255,
      minB: 20,
      maxB: 255,
    };

    const first = buildGroupTintVariation(sampleScene, 'g-enemies', options);
    const second = buildGroupTintVariation(sampleScene, 'g-enemies', options);

    expect(second).toEqual(first);
    expect(Object.keys(first)).toEqual(sampleScene.groups['g-enemies'].members);
    expect(Object.values(first).every((tint) => tint >= 0x141414 && tint <= 0xffffff)).toBe(true);
    expect(new Set(Object.values(first)).size).toBeGreaterThan(1);
  });

  it('targets only selected members for selection scope', () => {
    const tints = buildGroupTintVariation(
      sampleScene,
      'g-enemies',
      {
        scope: 'selection',
        seed: 'stars-selection',
        minR: 20,
        maxR: 255,
        minG: 20,
        maxG: 255,
        minB: 20,
        maxB: 255,
      },
      new Set(['e2', 'e4'])
    );

    expect(Object.keys(tints)).toEqual(['e2', 'e4']);
  });
});
