import { describe, expect, test } from 'vitest';
import { ParametricMotionUntil } from '../../src/runtime/actions/ParametricMotionUntil';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';

function makeEntity(id = 'e1') {
  return { id, x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, flipX: false, flipY: true };
}

describe('ParametricMotionUntil flip overrides', () => {
  test('applies flipX/flipY while running and restores on stop', () => {
    const entity = makeEntity();
    const action = new ParametricMotionUntil(entity, (t) => [10 * t, 0], new ElapsedTime(10), {
      durationMs: 10,
      rotateWithPath: false,
      flipX: true,
      flipY: false,
    } as any);

    action.start();
    // Flip overrides should take effect immediately on start to avoid a 1-frame glitch
    // when chaining actions (e.g. outward spiral -> inward spiral).
    expect(entity.flipX).toBe(true);
    expect(entity.flipY).toBe(false);
    action.update(5);
    expect(entity.flipX).toBe(true);
    expect(entity.flipY).toBe(false);

    // Complete
    action.update(10);
    expect(action.isComplete()).toBe(true);
    expect(entity.flipX).toBe(false);
    expect(entity.flipY).toBe(true);
  });
});
