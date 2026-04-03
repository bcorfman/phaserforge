import { describe, expect, it } from 'vitest';
import { MoveUntil } from '../../src/runtime/actions/MoveUntil';
import { BoundsHit } from '../../src/runtime/conditions/BoundsHit';
import { createFormationGroup } from '../../src/runtime/targets/createFormationGroup';
import { RuntimeEntity } from '../../src/runtime/targets/types';

function makeEntity(id: string, x: number, y: number): RuntimeEntity {
  return {
    id,
    x,
    y,
    width: 10,
    height: 10,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
  };
}

describe('MoveUntil group semantics', () => {
  it('moves a formation target without flattening away group operations', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 0, 0),
      makeEntity('e2', 20, 0),
      makeEntity('e3', 40, 0),
    ]);
    const move = new MoveUntil(
      group,
      { x: 50, y: 0 },
      new BoundsHit({ minX: -100, maxX: 100, minY: -100, maxY: 100 }, 'any', {
        scope: 'group-extents',
        behavior: 'stop',
      })
    );

    move.start();
    move.update(100);

    expect(group.members.map((member) => member.x)).toEqual([5, 25, 45]);
  });

  it('clamps a fast formation overshoot as a group before completing', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 15, 0),
      makeEntity('e2', 35, 0),
      makeEntity('e3', 55, 0),
    ]);
    const move = new MoveUntil(
      group,
      { x: 100, y: 0 },
      new BoundsHit({ minX: 0, maxX: 60, minY: -100, maxY: 100 }, 'any', {
        scope: 'group-extents',
        behavior: 'limit',
      })
    );

    move.start();
    move.update(100);

    expect(move.isComplete()).toBe(true);
    expect(group.getBounds().maxX).toBe(60);
    expect(group.members[1].x - group.members[0].x).toBe(20);
  });

  it('keeps single-entity behavior unchanged', () => {
    const entity = makeEntity('e1', 0, 0);
    const move = new MoveUntil(
      entity,
      { x: 10, y: 0 },
      new BoundsHit({ minX: -100, maxX: 100, minY: -100, maxY: 100 }, 'any')
    );

    move.start();
    move.update(100);

    expect(entity.x).toBe(1);
    expect(move.isComplete()).toBe(false);
  });
});
