import { describe, expect, it } from 'vitest';
import { computeAabbBounds } from '../../src/runtime/geometry/aabbBounds';

describe('computeAabbBounds', () => {
  it('returns a zero rect for empty input', () => {
    expect(computeAabbBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('returns the same rect for a single input', () => {
    expect(computeAabbBounds([{ minX: 1, minY: 2, maxX: 3, maxY: 4 }])).toEqual({
      minX: 1,
      minY: 2,
      maxX: 3,
      maxY: 4,
    });
  });

  it('combines multiple rects', () => {
    expect(computeAabbBounds([
      { minX: 10, minY: 20, maxX: 40, maxY: 60 },
      { minX: -5, minY: 22, maxX: 15, maxY: 55 },
      { minX: 0, minY: -10, maxX: 12, maxY: 0 },
    ])).toEqual({
      minX: -5,
      minY: -10,
      maxX: 40,
      maxY: 60,
    });
  });
});

