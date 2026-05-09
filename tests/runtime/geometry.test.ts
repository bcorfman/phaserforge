import { describe, expect, it } from 'vitest';
import { getRotatedEntityBounds, getRotatedEntityBoundaryCorners } from '../../src/runtime/geometry';

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

describe('rotated entity boundary corners', () => {
  it('returns null when no hitbox is present', () => {
    expect(getRotatedEntityBoundaryCorners({ x: 0, y: 0, width: 10, height: 10, rotationDeg: 0 })).toBeNull();
  });

  it('returns world-space corners for an unrotated hitbox', () => {
    expect(getRotatedEntityBoundaryCorners({
      x: 100,
      y: 200,
      width: 20,
      height: 10,
      rotationDeg: 0,
      hitbox: { x: 2, y: 3, width: 4, height: 5 },
    })).toEqual([
      { x: 92, y: 198 },
      { x: 96, y: 198 },
      { x: 96, y: 203 },
      { x: 92, y: 203 },
    ]);
  });

  it('mirrors the hitbox when flipX is enabled', () => {
    expect(getRotatedEntityBoundaryCorners({
      x: 100,
      y: 200,
      width: 20,
      height: 10,
      rotationDeg: 0,
      flipX: true,
      hitbox: { x: 2, y: 3, width: 4, height: 5 },
    })).toEqual([
      { x: 104, y: 198 },
      { x: 108, y: 198 },
      { x: 108, y: 203 },
      { x: 104, y: 203 },
    ]);
  });
});
