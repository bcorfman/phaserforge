import { describe, expect, it } from 'vitest';
import type { RuntimeEntity } from '../../src/runtime/targets/types';
import { Never } from '../../src/runtime/conditions/Never';
import { TweenUntil } from '../../src/runtime/actions/TweenUntil';

function makeEntity(partial?: Partial<RuntimeEntity>): RuntimeEntity {
  return {
    id: 'entity',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    vx: 0,
    vy: 0,
    ...partial,
  };
}

describe('TweenUntil', () => {
  it('tweens a numeric property from current value to target over duration', () => {
    const target = makeEntity({ vy: 10 });
    const action = new TweenUntil([target], {
      property: 'vy',
      from: 'current',
      endValue: -10,
      durationMs: 1000,
      easing: 'linear',
      condition: new Never(),
    });

    action.start();
    action.update(500);

    expect(target.vy).toBeCloseTo(0, 5);
    expect(action.isComplete()).toBe(false);

    action.update(500);

    expect(target.vy).toBeCloseTo(-10, 5);
    expect(action.isComplete()).toBe(true);
  });

  it('supports durationMs=0 by snapping to endValue immediately', () => {
    const target = makeEntity({ x: 5 });
    const action = new TweenUntil([target], {
      property: 'x',
      from: 'current',
      endValue: 25,
      durationMs: 0,
      easing: 'linear',
      condition: new Never(),
    });

    action.start();

    expect(target.x).toBe(25);
    expect(action.isComplete()).toBe(true);
  });
});

