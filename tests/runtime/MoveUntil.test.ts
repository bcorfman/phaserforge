import { describe, expect, it } from 'vitest';
import { MoveUntil } from '../../src/runtime/actions/MoveUntil';
import { BoundsHit } from '../../src/runtime/conditions/BoundsHit';
import { RuntimeEntity } from '../../src/runtime/targets/types';

function makeEntity(partial?: Partial<RuntimeEntity>): RuntimeEntity {
  return {
    id: 'entity',
    x: 100,
    y: 100,
    width: 20,
    height: 20,
    ...partial,
  };
}

describe('MoveUntil', () => {
  it('clamps an overshooting sprite to the boundary before completing', () => {
    const target = makeEntity({ x: 195 });
    const action = new MoveUntil(
      [target],
      { x: 100, y: 0 },
      new BoundsHit({ minX: 0, maxX: 200, minY: 0, maxY: 200 }, 'any')
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(190);
    expect(target.y).toBe(100);
    expect(action.isComplete()).toBe(true);
  });

  it('clamps every member of a group when any member hits the edge', () => {
    const targets = [
      makeEntity({ id: 'leader', x: 195 }),
      makeEntity({ id: 'follower', x: 180 }),
    ];
    const action = new MoveUntil(
      targets,
      { x: 100, y: 0 },
      new BoundsHit({ minX: 0, maxX: 200, minY: 0, maxY: 200 }, 'any')
    );

    action.start();
    action.update(100);

    expect(targets[0].x).toBe(190);
    expect(targets[1].x).toBe(190);
    expect(action.isComplete()).toBe(true);
  });
});
