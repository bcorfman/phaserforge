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
  it('uses the configured velocity before a boundary hit', () => {
    const target = makeEntity({ x: 100 });
    const action = new MoveUntil(
      [target],
      { x: 140, y: 0 },
      new BoundsHit({ minX: 0, maxX: 400, minY: 0, maxY: 400 }, 'any')
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(114);
    expect(target.vx).toBe(140);
    expect(action.isComplete()).toBe(false);
  });

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

  it('uses rotated extents when clamping to the boundary', () => {
    const target = makeEntity({ x: 186, width: 40, height: 20, rotationDeg: 90 });
    const action = new MoveUntil(
      [target],
      { x: 100, y: 0 },
      new BoundsHit({ minX: 0, maxX: 200, minY: 0, maxY: 200 }, 'any')
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(190);
    expect(action.isComplete()).toBe(true);
  });

  it('keeps moving when clamped back into bounds while traveling inward', () => {
    const target = makeEntity({ x: 5 });
    const action = new MoveUntil(
      [target],
      { x: 50, y: 0 },
      new BoundsHit(
        { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        'any',
        { behavior: 'limit' }
      )
    );

    action.start();
    action.update(50);

    expect(target.x).toBeCloseTo(10, 5);
    expect(target.vx).toBe(50);
    expect(action.isComplete()).toBe(false);

    action.update(50);

    expect(target.x).toBeGreaterThan(10);
    expect(action.isComplete()).toBe(false);
  });

  it('does not throw when BoundsHit spans are smaller than the target', () => {
    const target = makeEntity({ x: 100, y: 100, width: 40, height: 40 });
    const action = new MoveUntil(
      [target],
      { x: 10, y: 0 },
      new BoundsHit({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, 'any')
    );

    expect(() => action.start()).not.toThrow();
  });

  it('keeps moving with the bounced velocity instead of completing on first contact', () => {
    const target = makeEntity({ x: 185 });
    const action = new MoveUntil(
      [target],
      { x: 200, y: 0 },
      new BoundsHit(
        { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        'any',
        { behavior: 'bounce' }
      )
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(190);
    expect(target.vx).toBe(-200);
    expect(action.isComplete()).toBe(false);

    action.update(100);

    expect(target.x).toBe(170);
    expect(target.vx).toBe(-200);
    expect(action.isComplete()).toBe(false);
  });

  it('wraps to the opposite boundary and keeps moving', () => {
    const target = makeEntity({ x: 185 });
    const action = new MoveUntil(
      [target],
      { x: 200, y: 0 },
      new BoundsHit(
        { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        'any',
        { behavior: 'wrap' }
      )
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(10);
    expect(target.vx).toBe(200);
    expect(action.isComplete()).toBe(false);

    action.update(100);

    expect(target.x).toBe(30);
    expect(action.isComplete()).toBe(false);
  });

  it('stops and completes when behavior is stop', () => {
    const target = makeEntity({ x: 185 });
    const action = new MoveUntil(
      [target],
      { x: 200, y: 0 },
      new BoundsHit(
        { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        'any',
        { behavior: 'stop' }
      )
    );

    action.start();
    action.update(100);

    expect(target.x).toBe(190);
    expect(target.vx).toBe(0);
    expect(action.isComplete()).toBe(true);
  });

});
