import { describe, expect, it } from 'vitest';
import { computeEdgeSafeBounds } from '../../src/editor/boundsHelper';

describe('boundsHelper', () => {
  it('computes edge-safe bounds from center, span, and half-size', () => {
    expect(computeEdgeSafeBounds({ cx: 100, cy: 50, xSpan: 20, ySpan: 10, halfW: 8, halfH: 6 })).toEqual({
      minX: 72,
      maxX: 128,
      minY: 34,
      maxY: 66,
    });
  });
});

