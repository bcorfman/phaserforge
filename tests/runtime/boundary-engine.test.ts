import { describe, expect, it } from 'vitest';
import { BoundaryEngine } from '../../src/runtime/boundaries/BoundaryEngine';
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

describe('boundary engine', () => {
  it('detects group-extents bounds hits from aggregate edges', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 10, 0),
      makeEntity('e2', 30, 0),
      makeEntity('e3', 50, 0),
    ]);
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 50, minY: -100, maxY: 100 },
      { scope: 'group-extents', behavior: 'limit' }
    );

    expect(engine.isMet(group)).toBe(true);
  });

  it('limits an overshooting formation by offset and preserves layout', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 15, 0),
      makeEntity('e2', 35, 0),
      makeEntity('e3', 55, 0),
    ]);
    group.setVelocity(100, 0);
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 60, minY: -100, maxY: 100 },
      { scope: 'group-extents', behavior: 'limit' }
    );

    const result = engine.apply(group);

    expect(result.hit).toBe(true);
    expect(result.sides.x).toBe('right');
    expect(group.getBounds().maxX).toBe(60);
    expect(group.members[1].x - group.members[0].x).toBe(20);
    expect(group.members.every((member) => member.vx === 0)).toBe(true);
  });

  it('bounces a formation once and does not double-trigger enter while pinned', () => {
    const events: string[] = [];
    const group = createFormationGroup('g1', [
      makeEntity('e1', 15, 0),
      makeEntity('e2', 35, 0),
      makeEntity('e3', 55, 0),
    ]);
    group.setVelocity(100, 0);
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 60, minY: -100, maxY: 100 },
      {
        scope: 'group-extents',
        behavior: 'bounce',
        onEnter: (_target, axis, side) => events.push(`enter:${axis}:${side}`),
        onExit: (_target, axis, side) => events.push(`exit:${axis}:${side}`),
      }
    );

    engine.apply(group);
    engine.apply(group);

    expect(group.members.every((member) => member.vx === -100)).toBe(true);
    expect(events.filter((event) => event === 'enter:x:right')).toHaveLength(1);

    group.translate(-10, 0);
    engine.apply(group);

    expect(events).toContain('exit:x:right');
  });

  it('wraps a formation by offset without scrambling member spacing', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 15, 0),
      makeEntity('e2', 35, 0),
      makeEntity('e3', 55, 0),
    ]);
    group.setVelocity(100, 0);
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 60, minY: -100, maxY: 100 },
      { scope: 'group-extents', behavior: 'wrap' }
    );

    engine.apply(group);

    expect(group.getBounds().minX).toBe(0);
    expect(group.getBounds().maxX).toBe(50);
    expect(group.members[1].x - group.members[0].x).toBe(20);
    expect(group.members[2].x - group.members[1].x).toBe(20);
  });
});
