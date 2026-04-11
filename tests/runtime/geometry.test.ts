import { describe, expect, it } from 'vitest';
import { getRotatedEntityBounds } from '../../src/runtime/geometry';

describe('rotated entity bounds', () => {
  it('matches raw width/height at zero degrees', () => {
    expect(getRotatedEntityBounds({ x: 100, y: 200, width: 20, height: 10, rotationDeg: 0 })).toEqual({
      minX: 90,
      maxX: 110,
      minY: 195,
      maxY: 205,
    });
  });

  it('swaps extents at ninety degrees', () => {
    const bounds = getRotatedEntityBounds({ x: 0, y: 0, width: 20, height: 10, rotationDeg: 90 });
    expect(bounds.minX).toBeCloseTo(-5);
    expect(bounds.maxX).toBeCloseTo(5);
    expect(bounds.minY).toBeCloseTo(-10);
    expect(bounds.maxY).toBeCloseTo(10);
  });

  it('includes authored scale in occupied extents', () => {
    const bounds = getRotatedEntityBounds({ x: 50, y: 50, width: 20, height: 10, scaleX: 2, scaleY: 3, rotationDeg: 0 });
    expect(bounds).toEqual({
      minX: 30,
      maxX: 70,
      minY: 35,
      maxY: 65,
    });
  });

  it('respects origin when computing extents', () => {
    const bounds = getRotatedEntityBounds({ x: 100, y: 100, width: 20, height: 10, originX: 0, originY: 0, rotationDeg: 0 });
    expect(bounds).toEqual({
      minX: 100,
      maxX: 120,
      minY: 100,
      maxY: 110,
    });
  });
});
