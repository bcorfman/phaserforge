import { describe, it, expect } from 'vitest';
import { Wait } from '../../src/runtime/actions/Wait';
import { Call } from '../../src/runtime/actions/Call';
import { Sequence } from '../../src/runtime/actions/Sequence';
import { MoveUntil } from '../../src/runtime/actions/MoveUntil';
import { BoundsHit } from '../../src/runtime/conditions/BoundsHit';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';
import { ActionManager } from '../../src/runtime/ActionManager';

function makeEntity(id: string, x = 0, y = 0) {
  return { id, x, y, width: 10, height: 10 };
}

describe('runtime actions', () => {
  it('B1 Wait completes after enough elapsed time', () => {
    const wait = new Wait(100);
    wait.start();
    wait.update(50);
    expect(wait.isComplete()).toBe(false);
    wait.update(50);
    expect(wait.isComplete()).toBe(true);
  });

  it('B2 Call fires exactly once', () => {
    let count = 0;
    const call = new Call(() => {
      count += 1;
    });
    call.start();
    call.update(16);
    call.update(16);
    expect(count).toBe(1);
    expect(call.isComplete()).toBe(true);
  });

  it('B3 Sequence preserves child order', () => {
    const log: string[] = [];
    const seq = new Sequence([
      new Wait(50),
      new Call(() => log.push('done')),
    ]);
    seq.start();
    seq.update(49);
    expect(log).toEqual([]);
    seq.update(1);
    expect(log).toEqual(['done']);
  });

  it('B4 Sequence of Calls preserves exact order', () => {
    const log: string[] = [];
    const seq = new Sequence([
      new Call(() => log.push('a')),
      new Call(() => log.push('b')),
      new Call(() => log.push('c')),
    ]);
    seq.start();
    seq.update(0);
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('B5 MoveUntil mutates target while condition false', () => {
    const entity = makeEntity('e1');
    const condition = new BoundsHit(
      { minX: -100, maxX: 100, minY: -100, maxY: 100 },
      'any'
    );
    const move = new MoveUntil([entity], { x: 10, y: 0 }, condition);
    move.start();
    move.update(100);
    expect(entity.x).toBeGreaterThan(0);
  });

  it('B6 MoveUntil completes deterministically when condition met', () => {
    const entity = makeEntity('e1', 95, 0);
    const condition = new BoundsHit(
      { minX: 0, maxX: 100, minY: -100, maxY: 100 },
      'any'
    );
    const move = new MoveUntil([entity], { x: 100, y: 0 }, condition);
    move.start();
    move.update(100);
    expect(move.isComplete()).toBe(true);
    const xAfter = entity.x;
    move.update(100);
    expect(entity.x).toBe(xAfter);
  });

  it('B7 Group target applies to all intended members', () => {
    const e1 = makeEntity('e1');
    const e2 = makeEntity('e2', 5, 0);
    const condition = new BoundsHit(
      { minX: -100, maxX: 100, minY: -100, maxY: 100 },
      'any'
    );
    const move = new MoveUntil([e1, e2], { x: 10, y: 0 }, condition);
    move.start();
    move.update(100);
    expect(e1.x).toBeGreaterThan(0);
    expect(e2.x).toBeGreaterThan(5);
  });

  it('B8 BoundsHit(mode=any) resolves when one group member hits bound', () => {
    const e1 = makeEntity('e1', 0, 0);
    const e2 = makeEntity('e2', 200, 0);
    const condition = new BoundsHit(
      { minX: 0, maxX: 100, minY: -100, maxY: 100 },
      'any'
    );
    expect(condition.isMet([e1, e2])).toBe(true);
  });

  it('B9 ActionManager removes completed actions', () => {
    const manager = new ActionManager();
    const wait = new Wait(10);
    manager.add(wait);
    manager.update(10);
    expect(manager.size()).toBe(0);
  });

  it('B10 cancellation stops mutation', () => {
    const entity = makeEntity('e1');
    const condition = new ElapsedTime(1000);
    const move = new MoveUntil([entity], { x: 10, y: 0 }, condition);
    move.start();
    move.update(100);
    const before = entity.x;
    move.cancel?.();
    move.update(100);
    expect(entity.x).toBe(before);
  });
});
