import { describe, expect, test, vi } from 'vitest';
import type { RuntimeEntity } from '../../src/runtime/targets/types';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';
import { ParametricMotionUntil } from '../../src/runtime/actions/ParametricMotionUntil';

function makeEntity(id = 'e1'): RuntimeEntity {
  return { id, x: 0, y: 0, width: 10, height: 10, rotationDeg: 0 };
}

describe('ParametricMotionUntil', () => {
  test('applies relative offsets over time and completes', () => {
    const entity = makeEntity();
    entity.x = 100;
    entity.y = 100;

    const durationMs = 1000;
    const action = new ParametricMotionUntil(
      entity,
      (t) => [100 * t, 50 * t],
      new ElapsedTime(durationMs),
      { durationMs },
    );

    action.start();
    for (let i = 0; i < 60; i += 1) action.update(durationMs / 60);

    expect(action.isComplete()).toBe(true);
    expect(entity.x).toBeCloseTo(200, 3);
    expect(entity.y).toBeCloseTo(150, 3);
  });

  test('rotateWithPath updates rotationDeg along diagonal', () => {
    const entity = makeEntity();
    entity.x = 0;
    entity.y = 0;

    const durationMs = 500;
    const action = new ParametricMotionUntil(
      entity,
      (t) => [t, t],
      new ElapsedTime(durationMs),
      { durationMs, rotateWithPath: true, rotationOffsetDeg: 0 },
    );

    action.start();
    for (let i = 0; i < 10; i += 1) action.update(durationMs / 30);

    expect(entity.rotationDeg).toBeCloseTo(45, 1);
  });

  test('factor scales progress speed', () => {
    const entity = makeEntity();
    entity.x = 10;
    entity.y = 20;

    const durationMs = 1000;
    const offsetFn = (t: number) => [300 * t, 0] as const;

    const half = new ParametricMotionUntil(entity, offsetFn, new ElapsedTime(durationMs), { durationMs });
    half.start();
    half.setFactor(0.5);
    for (let i = 0; i < 30; i += 1) half.update(durationMs / 60);
    const xHalf = entity.x;

    entity.x = 10;
    entity.y = 20;
    const full = new ParametricMotionUntil(entity, offsetFn, new ElapsedTime(durationMs), { durationMs });
    full.start();
    full.setFactor(1.0);
    for (let i = 0; i < 30; i += 1) full.update(durationMs / 60);
    const xFull = entity.x;

    expect(xFull - 10).toBeGreaterThan(xHalf - 10);
  });

  test('onStop called once on completion', () => {
    const entity = makeEntity();
    entity.x = 5;
    entity.y = 5;

    const durationMs = 200;
    const onStop = vi.fn();
    const action = new ParametricMotionUntil(entity, (t) => [50 * t, 0], new ElapsedTime(durationMs), { durationMs, onStop });
    action.start();
    for (let i = 0; i < 20; i += 1) action.update(durationMs / 10);

    expect(action.isComplete()).toBe(true);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('debug mode warns on large jumps', () => {
    const entity = makeEntity();
    entity.x = 100;
    entity.y = 100;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const durationMs = 1000;
    const action = new ParametricMotionUntil(
      entity,
      (t) => (t < 0.5 ? [t * 10, 0] : [t * 10 + 500, 0]),
      new ElapsedTime(durationMs),
      { durationMs, debug: true, debugThreshold: 100, rotateWithPath: true },
    );
    action.start();
    for (let i = 0; i < 40; i += 1) action.update(durationMs / 60);

    expect(warn.mock.calls.some((call) => String(call[0]).includes('[ParametricMotionUntil:jump]'))).toBe(true);
    warn.mockRestore();
  });
});

