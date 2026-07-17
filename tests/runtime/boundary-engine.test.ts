import { describe, expect, it } from 'vitest';
import { BoundaryEngine, type BoundaryEvent } from '../../src/runtime/boundaries/BoundaryEngine';
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

  it('clamps using hitbox edges instead of full sprite bounds', () => {
    const entity: RuntimeEntity & { hitbox?: { x: number; y: number; width: number; height: number } } = {
      id: 'e1',
      x: 55,
      y: 0,
      width: 64,
      height: 64,
      originX: 0.5,
      originY: 0.5,
      scaleX: 1,
      scaleY: 1,
      rotationDeg: 0,
      vx: 100,
      vy: 0,
      hitbox: { x: 22, y: 22, width: 20, height: 20 },
    };
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 60, minY: -100, maxY: 100 },
      { scope: 'member-any', behavior: 'limit' }
    );

    engine.apply(entity);

    const originX = entity.originX ?? 0.5;
    const hitbox = entity.hitbox!;
    const hitboxMaxX = entity.x + (hitbox.x + hitbox.width - originX * entity.width);
    expect(hitboxMaxX).toBe(60);
    expect(entity.x).toBe(50);
  });

  it('computes group-extents contacts from hitbox edges', () => {
    const group = createFormationGroup('g1', [
      makeEntity('e1', 15, 0),
      makeEntity('e2', 35, 0),
      makeEntity('e3', 55, 0),
    ]);
    for (const member of group.members) {
      member.hitbox = { x: 2, y: 2, width: 6, height: 6 };
    }
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 60, minY: -100, maxY: 100 },
      { scope: 'group-extents', behavior: 'limit' }
    );

    expect(engine.isMet(group)).toBe(false);

    group.translate(2, 0);

    expect(engine.isMet(group)).toBe(true);
  });

  it('emits member-local vertical wrap events after relocating upward crossings', () => {
    const events: BoundaryEvent[] = [];
    const member = makeEntity('star-1', 100, -2);
    member.vy = -240;
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'wrap', onEvent: (event) => events.push(event) }
    );

    engine.apply(member);

    expect(member.y).toBe(1275);
    expect(events.map((event) => `${event.outcome}:${event.axis}:${event.side}:${event.source.id}`)).toEqual([
      'contact-entered:y:bottom:star-1',
      'wrapped:y:bottom:star-1',
      'contact-exited:y:bottom:star-1',
    ]);
    const wrapped = events.find((event) => event.outcome === 'wrapped');
    expect(wrapped?.priorPosition).toEqual({ x: 100, y: -2 });
    expect(wrapped?.position).toEqual({ x: 100, y: 1275 });
  });

  it('emits member-local vertical wrap events for downward crossings', () => {
    const events: BoundaryEvent[] = [];
    const member = makeEntity('star-2', 100, 1282);
    member.vy = 840;
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'wrap', onEvent: (event) => events.push(event) }
    );

    engine.apply(member);

    expect(member.y).toBe(5);
    expect(events.map((event) => `${event.outcome}:${event.axis}:${event.side}:${event.source.id}`)).toEqual([
      'contact-entered:y:top:star-2',
      'wrapped:y:top:star-2',
      'contact-exited:y:top:star-2',
    ]);
  });

  it('emits one wrapped event per horizontal crossing and reports exact member source', () => {
    const events: BoundaryEvent[] = [];
    const left = makeEntity('left', -2, 100);
    const right = makeEntity('right', 100, 100);
    left.vx = -20;
    right.vx = 0;
    const engine = new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'wrap', onEvent: (event) => events.push(event) }
    );

    engine.apply(createFormationGroup('stars', [left, right]));
    engine.apply(createFormationGroup('stars', [left, right]));

    const wrapped = events.filter((event) => event.outcome === 'wrapped');
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]).toMatchObject({ axis: 'x', side: 'left' });
    expect(wrapped[0].source).toBe(left);
    expect(right.x).toBe(100);
  });

  it('emits bounced, clamped, and stopped outcomes with behavior-specific effects', () => {
    const bouncedEvents: BoundaryEvent[] = [];
    const bounced = makeEntity('bounced', 715, 100);
    bounced.vx = 60;
    new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'bounce', onEvent: (event) => bouncedEvents.push(event) }
    ).apply(bounced);
    expect(bounced.vx).toBe(-60);
    expect(bouncedEvents.some((event) => event.outcome === 'bounced' && event.source === bounced)).toBe(true);

    const clampedEvents: BoundaryEvent[] = [];
    const clamped = makeEntity('clamped', 715, 100);
    clamped.vx = 60;
    new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'limit', onEvent: (event) => clampedEvents.push(event) }
    ).apply(clamped);
    expect(clamped.x).toBe(715);
    expect(clamped.vx).toBe(0);
    expect(clampedEvents.some((event) => event.outcome === 'clamped' && event.source === clamped)).toBe(true);

    const stoppedEvents: BoundaryEvent[] = [];
    const stopped = makeEntity('stopped', 715, 100);
    stopped.vx = 60;
    new BoundaryEngine(
      { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      { scope: 'member-any', behavior: 'stop', onEvent: (event) => stoppedEvents.push(event) }
    ).apply(stopped);
    expect(stopped.x).toBe(715);
    expect(stopped.vx).toBe(0);
    expect(stoppedEvents.some((event) => event.outcome === 'stopped' && event.source === stopped)).toBe(true);
  });
});
