import { describe, expect, it } from 'vitest';
import { syncBoundsToWorldResize } from '../../src/editor/worldBounds';
import { sampleScene } from '../../src/model/sampleScene';

describe('syncBoundsToWorldResize', () => {
  it('preserves bounds insets from the world edges when resizing the world', () => {
    const next = syncBoundsToWorldResize(sampleScene, { width: 800, height: 600 });

    expect(next.world).toEqual({ width: 800, height: 600 });
    const bounds = next.attachments['att-move-right'].condition?.type === 'BoundsHit'
      ? next.attachments['att-move-right'].condition.bounds
      : undefined;
    expect(bounds).toEqual({ minX: 80, minY: 60, maxX: 720, maxY: 552 });
  });
});
