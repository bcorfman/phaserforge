import { describe, expect, test } from 'vitest';
import { Never } from '../../src/runtime/conditions/Never';
import { OrbitPattern } from '../../src/runtime/actions/OrbitPattern';
import type { RuntimeEntity } from '../../src/runtime/targets/types';
import { buildFigureEightOffset, buildWaveOffset, buildZigzagOffset } from '../../src/runtime/patterns/movementPatterns';

describe('movement pattern helpers (detail)', () => {
  test('zigzag final segment clamps progress', () => {
    const offsetFn = buildZigzagOffset({ width: 12, height: 6, segments: 3 });
    const [dx, dy] = offsetFn(1);
    expect(dx).toBeCloseTo(12, 6);
    expect(dy).toBeCloseTo(18, 6);
  });

  test('wave full cycle snaps to origin', () => {
    const offsetFn = buildWaveOffset({ amplitude: 20, length: 60, startProgress: 0, endProgress: 1 });
    const [dx, dy] = offsetFn(1);
    expect(dx).toBeCloseTo(0, 6);
    expect(dy).toBeCloseTo(0, 6);
  });

  test('wave partial cycle preserves offset', () => {
    const offsetFn = buildWaveOffset({ amplitude: 15, length: 40, startProgress: 0.5, endProgress: 0.75 });
    const [dx, dy] = offsetFn(1);
    expect(Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6).toBe(true);
  });

  test('figure eight exposes control points', () => {
    const { offsetFn, controlPoints } = buildFigureEightOffset({ width: 100, height: 50, includeControlPoints: true });
    expect(controlPoints?.length).toBe(17);
    const start = controlPoints?.[0];
    const end = controlPoints?.[controlPoints.length - 1];
    expect(start?.[0]).toBeCloseTo(end?.[0] ?? NaN, 12);
    expect(start?.[1]).toBeCloseTo(end?.[1] ?? NaN, 12);
    expect(offsetFn(0)).toEqual([0, 0]);
  });

  test('orbit pattern starts on edge when centered and completes a cycle', () => {
    const entity: RuntimeEntity = { id: 'e1', x: 0, y: 0, width: 10, height: 10 };
    const action = new OrbitPattern(entity, { radius: 15, velocity: 120, clockwise: false, condition: new Never(), centerMode: 'current' });
    action.start();
    expect(entity.x).toBeCloseTo(15, 6);
    expect(entity.y).toBeCloseTo(0, 6);

    for (let i = 0; i < 600 && !action.isComplete(); i += 1) {
      action.update(16);
    }
    expect(action.isComplete()).toBe(true);
    expect(entity.x).toBeCloseTo(15, 1);
    expect(entity.y).toBeCloseTo(0, 1);
  });
});
