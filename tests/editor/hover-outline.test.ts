import { describe, expect, it } from 'vitest';
import { getHoverOutlineShape } from '../../src/editor/canvasInteraction';

describe('getHoverOutlineShape', () => {
  it('uses the hovered group zone bounds instead of placeholder geometry', () => {
    const shape = getHoverOutlineShape(
      { kind: 'group', id: 'g-enemies' },
      new Map(),
      new Map([
        ['g-enemies', { getBounds: () => ({ x: 200, y: 100, width: 320, height: 180 }) }],
      ]) as any,
      undefined
    );

    expect(shape).toEqual({
      kind: 'rounded-rect',
      x: 200,
      y: 100,
      width: 320,
      height: 180,
      radius: 10,
    });
  });

  it('uses the live bounds rectangle for bounds hover', () => {
    const shape = getHoverOutlineShape(
      { kind: 'bounds-body', id: 'bounds' },
      new Map(),
      new Map(),
      { minX: 80, minY: 60, maxX: 944, maxY: 720 }
    );

    expect(shape).toEqual({
      kind: 'rect',
      x: 80,
      y: 60,
      width: 864,
      height: 660,
    });
  });
});
