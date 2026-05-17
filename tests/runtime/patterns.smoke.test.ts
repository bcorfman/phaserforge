import { describe, expect, test } from 'vitest';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';
import type { RuntimeEntity } from '../../src/runtime/targets/types';
import { buildFigureEightOffset, buildOrbitOffset, buildSpiralOffset, buildWaveOffset, buildZigzagOffset } from '../../src/runtime/patterns/movementPatterns';
import { ParametricMotionUntil } from '../../src/runtime/actions/ParametricMotionUntil';

function makeEntity(id = 'e1'): RuntimeEntity {
  return { id, x: 0, y: 0, width: 10, height: 10 };
}

describe('movement pattern factories (smoke)', () => {
  test('zigzag runs with frame args', () => {
    const offsetFn = buildZigzagOffset({ width: 100, height: 50, segments: 3 });
    const entity = makeEntity();
    const action = new ParametricMotionUntil(entity, offsetFn, new ElapsedTime(100), { durationMs: 100 });
    action.start();
    action.update(16);
    expect(action.isComplete()).toBe(false);
  });

  test('wave uses velocity parameter (duration-based)', () => {
    const offsetFn = buildWaveOffset({ amplitude: 20, length: 60, startProgress: 0, endProgress: 1 });
    const entity = makeEntity();
    const action = new ParametricMotionUntil(entity, offsetFn, new ElapsedTime(30), { durationMs: 30 });
    action.start();
    action.update(16);
    expect(action.isComplete()).toBe(false);
  });

  test('spiral accepts condition', () => {
    const offsetFn = buildSpiralOffset({ maxRadius: 50, revolutions: 2, direction: 'outward' });
    const entity = makeEntity();
    const action = new ParametricMotionUntil(entity, offsetFn, new ElapsedTime(45), { durationMs: 45 });
    action.start();
    action.update(16);
    expect(action.isComplete()).toBe(false);
  });

  test('figure eight creates offsets', () => {
    const offsetFn = buildFigureEightOffset({ width: 100, height: 80 }).offsetFn;
    expect(offsetFn(0)).toEqual([0, 0]);
  });

  test('orbit creates offsets', () => {
    const offsetFn = buildOrbitOffset({ radius: 100, clockwise: true, startAngleRad: 0 });
    expect(offsetFn(0)).toEqual([0, 0]);
  });
});
