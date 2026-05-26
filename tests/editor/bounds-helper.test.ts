import { describe, expect, it } from 'vitest';
import { boundsToCenterSpan, computeEdgeSafeBounds, computeEntityAabb, computeTargetAabb } from '../../src/editor/boundsHelper';

describe('boundsHelper', () => {
  it('computes edge-safe bounds from center, span, and half-size', () => {
    expect(computeEdgeSafeBounds({ cx: 100, cy: 50, xSpan: 20, ySpan: 10, halfW: 8, halfH: 6 })).toEqual({
      minX: 72,
      maxX: 128,
      minY: 34,
      maxY: 66,
    });
  });

  it('converts bounds back into center/span (accounting for half-size)', () => {
    expect(boundsToCenterSpan({ bounds: { minX: 72, maxX: 128, minY: 34, maxY: 66 }, halfW: 8, halfH: 6 })).toEqual({
      cx: 100,
      cy: 50,
      xSpan: 20,
      ySpan: 10,
    });
  });

  it('computes an entity AABB from origin + scale', () => {
    expect(computeEntityAabb({ x: 100, y: 50, width: 20, height: 10, originX: 0.5, originY: 0.5, scaleX: 2, scaleY: 3 })).toEqual({
      minX: 80,
      maxX: 120,
      minY: 35,
      maxY: 65,
    });
  });

  it('computes a target AABB for an entity or group', () => {
    const scene: any = {
      entities: {
        a: { id: 'a', x: 10, y: 10, width: 10, height: 10 },
        b: { id: 'b', x: 30, y: 10, width: 10, height: 10 },
      },
      groups: {
        g: { id: 'g', members: ['a', 'b'] },
      },
    };

    expect(computeTargetAabb(scene, { type: 'entity', entityId: 'a' })).toEqual({ minX: 5, maxX: 15, minY: 5, maxY: 15 });
    expect(computeTargetAabb(scene, { type: 'group', groupId: 'g' })).toEqual({ minX: 5, maxX: 35, minY: 5, maxY: 15 });
  });
});
