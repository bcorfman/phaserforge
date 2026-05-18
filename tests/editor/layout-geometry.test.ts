import { describe, expect, it } from 'vitest';
import { alignByBounds, distributeCenters, snapPositions, spacingByCenters, type WorldRect } from '../../src/editor/layoutGeometry';

function rect(centerX: number, centerY: number, w: number, h: number): WorldRect {
  return { centerX, centerY, minX: centerX - w / 2, maxX: centerX + w / 2, minY: centerY - h / 2, maxY: centerY + h / 2 };
}

describe('layoutGeometry', () => {
  it('aligns by bounds edges', () => {
    const items = [
      { id: 'a', x: 10, y: 0, rect: rect(10, 0, 10, 10) },
      { id: 'b', x: 30, y: 0, rect: rect(30, 0, 10, 10) },
    ];
    const aligned = alignByBounds(items, 'left', 'a');
    const b = aligned.find((p) => p.id === 'b')!;
    expect(b.x).toBe(10);
  });

  it('distributes centers between endpoints', () => {
    const items = [
      { id: 'a', x: 0, y: 0, rect: rect(0, 0, 10, 10) },
      { id: 'b', x: 50, y: 0, rect: rect(50, 0, 10, 10) },
      { id: 'c', x: 100, y: 0, rect: rect(100, 0, 10, 10) },
    ];
    const distributed = distributeCenters(items, 'x');
    const b = distributed.find((p) => p.id === 'b')!;
    expect(b.x).toBeCloseTo(50, 6);
  });

  it('applies fixed spacing by centers and snaps', () => {
    const items = [
      { id: 'a', x: 0, y: 0, rect: rect(0, 0, 10, 10) },
      { id: 'b', x: 13, y: 0, rect: rect(13, 0, 10, 10) },
      { id: 'c', x: 29, y: 0, rect: rect(29, 0, 10, 10) },
    ];
    const spaced = spacingByCenters(items, 'x', 20);
    const snapped = snapPositions(spaced, 8);
    const b = snapped.find((p) => p.id === 'b')!;
    const c = snapped.find((p) => p.id === 'c')!;
    expect(b.x).toBe(24);
    expect(c.x).toBe(40);
  });
});

