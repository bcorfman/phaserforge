import { describe, expect, test } from 'vitest';
import { worldToScreen } from '../../src/phaser/worldToClient';

describe('worldToScreen', () => {
  test('projects world point into camera screen space', () => {
    expect(
      worldToScreen(
        { x: 15, y: 25 },
        { x: 0, y: 0, scrollX: 10, scrollY: 20, zoomX: 2, zoomY: 2, originX: 0, originY: 0 },
      ),
    ).toEqual({ x: 10, y: 10 });
  });

  test('accounts for camera viewport offsets', () => {
    expect(
      worldToScreen(
        { x: 50, y: 80 },
        { x: 100, y: 200, scrollX: 0, scrollY: 0, zoomX: 1, zoomY: 1, originX: 0, originY: 0 },
      ),
    ).toEqual({ x: 150, y: 280 });
  });

  test('applies origin offsets like Phaser camera matrices', () => {
    expect(
      worldToScreen(
        { x: 10, y: 20 },
        { x: 0, y: 0, scrollX: 0, scrollY: 0, zoomX: 2, zoomY: 2, originX: 100, originY: 200 },
      ),
    ).toEqual({ x: -80, y: -160 });
  });
});
