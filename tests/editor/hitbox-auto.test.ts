import { describe, expect, it } from 'vitest';
import { clampHitboxToEntity, computeHitboxFromImageData, mapHitboxToEntitySize } from '../../src/editor/hitboxAuto';

function makeImageData(width: number, height: number, alphaAt: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i + 3] = alphaAt(x, y);
    }
  }
  return { data, width, height };
}

describe('hitbox auto-fit', () => {
  it('returns null when no opaque pixels exist', () => {
    const imageData = makeImageData(4, 4, () => 0);
    expect(computeHitboxFromImageData(imageData)).toBeNull();
  });

  it('returns a tight bounding rect around opaque pixels', () => {
    const imageData = makeImageData(6, 5, (x, y) => (x >= 2 && x <= 4 && y >= 1 && y <= 3 ? 255 : 0));
    expect(computeHitboxFromImageData(imageData)).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });

  it('honors alphaThreshold', () => {
    const imageData = makeImageData(3, 3, (x, y) => (x === 1 && y === 1 ? 1 : 0));
    expect(computeHitboxFromImageData(imageData, { alphaThreshold: 2 })).toBeNull();
    expect(computeHitboxFromImageData(imageData, { alphaThreshold: 1 })).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });

  it('maps hitbox from source pixels into entity-local size', () => {
    const mapped = mapHitboxToEntitySize(
      { x: 10, y: 5, width: 20, height: 10 },
      { width: 100, height: 50 },
      { width: 200, height: 100 }
    );
    expect(mapped).toEqual({ x: 20, y: 10, width: 40, height: 20 });
  });

  it('clamps hitbox to entity size', () => {
    const clamped = clampHitboxToEntity({ x: -10, y: 5, width: 50, height: 50 }, { width: 32, height: 32 });
    expect(clamped).toEqual({ x: 0, y: 5, width: 32, height: 27 });
  });
});
