import { describe, expect, it } from 'vitest';
import {
  alignByBounds,
  alignSelectionToWorld,
  distributeCenters,
  getSelectionBounds,
  setSelectionCenter,
  snapPositions,
  spacingByCenters,
  type WorldRect
} from '../../src/editor/layoutGeometry';

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
      { id: 'b', x: 20, y: 0, rect: rect(20, 0, 10, 10) },
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

  it('computes selection bounds across items', () => {
    const items = [
      { rect: rect(10, 10, 10, 10) },
      { rect: rect(30, 10, 10, 10) },
    ];
    const bounds = getSelectionBounds(items)!;
    expect(bounds.minX).toBe(5);
    expect(bounds.maxX).toBe(35);
    expect(bounds.centerX).toBe(20);
  });

  it('alignSelectionToWorld centers the selection without changing internal spacing', () => {
    const items = [
      { id: 'a', x: 100, y: 0, rect: rect(100, 0, 10, 10) },
      { id: 'b', x: 200, y: 0, rect: rect(200, 0, 10, 10) },
    ];
    const centered = alignSelectionToWorld(items, 'centerX', 800, 600);
    const a = centered.find((p) => p.id === 'a')!;
    const b = centered.find((p) => p.id === 'b')!;
    expect(Math.round(b.x - a.x)).toBe(100);
    // The midpoint should land at world center (400).
    const mid = (a.x + b.x) / 2;
    expect(Math.round(mid)).toBe(400);
  });

  it('setSelectionCenter shifts the selection bounds center to a target', () => {
    const items = [
      { id: 'a', x: 100, y: 100, rect: rect(100, 100, 10, 10) },
      { id: 'b', x: 200, y: 100, rect: rect(200, 100, 10, 10) },
    ];
    const moved = setSelectionCenter(items, { y: 450 });
    const a = moved.find((p) => p.id === 'a')!;
    const b = moved.find((p) => p.id === 'b')!;
    expect(Math.round(a.y)).toBe(450);
    expect(Math.round(b.y)).toBe(450);
  });
});
