import { describe, expect, it } from 'vitest';
import { createSeededRandom, normalizeRange, randomFloatInRange, randomIntInRange } from '../../src/editor/deterministicRandom';
import { computeFormationDraftPositions, computeFormationDraftTints } from '../../src/editor/formationDraft';

describe('deterministic random helpers', () => {
  it('returns the same sequence for the same seed and stream', () => {
    const a = createSeededRandom('stars', 'position-x');
    const b = createSeededRandom('stars', 'position-x');
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
  });

  it('diverges for different seeds and named streams', () => {
    const x = createSeededRandom('stars', 'position-x');
    const y = createSeededRandom('stars', 'position-y');
    const other = createSeededRandom('other', 'position-x');
    const sameSeedX = Array.from({ length: 5 }, () => x());
    const sameSeedY = Array.from({ length: 5 }, () => y());
    const otherSeedX = Array.from({ length: 5 }, () => other());
    expect(sameSeedX).not.toEqual(sameSeedY);
    expect(sameSeedX).not.toEqual(otherSeedX);
  });

  it('normalizes reversed ranges', () => {
    expect(normalizeRange(10, -5)).toEqual({ min: -5, max: 10 });
  });

  it('generates finite floats inside normalized ranges', () => {
    const random = createSeededRandom('range', 'float');
    const values = Array.from({ length: 20 }, () => randomFloatInRange(random, 12, -3));
    expect(values.every((value) => Number.isFinite(value) && value >= -3 && value <= 12)).toBe(true);
  });

  it('generates inclusive integer color channel bounds', () => {
    expect(randomIntInRange(() => 0, 20, 255)).toBe(20);
    expect(randomIntInRange(() => 0.999999, 20, 255)).toBe(255);
  });

  it('keeps authored scatter results stable for the same seed, member index, and parameters', () => {
    const draft = {
      arrangeKind: 'scatter',
      memberCount: 8,
      params: {
        minX: 0,
        maxX: 720,
        minY: 5,
        maxY: 1285,
        seed: 'stars-contract',
        randomTint: true,
        tintMinR: 20,
        tintMaxR: 255,
        tintMinG: 20,
        tintMaxG: 255,
        tintMinB: 20,
        tintMaxB: 255,
      },
    };

    const authored = computeFormationDraftPositions(draft, { width: 3, height: 3 })
      .map((position, index) => ({ ...position, tint: computeFormationDraftTints(draft)?.[index] }));
    const reloaded = computeFormationDraftPositions({ ...draft, params: { ...draft.params } }, { width: 3, height: 3 })
      .map((position, index) => ({ ...position, tint: computeFormationDraftTints({ ...draft, params: { ...draft.params } })?.[index] }));

    expect(reloaded).toEqual(authored);
  });
});
