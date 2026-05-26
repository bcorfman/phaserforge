import { describe, expect, test } from 'vitest';
import { ParametricMotionUntil } from '../../src/runtime/actions/ParametricMotionUntil';
import { Sequence } from '../../src/runtime/actions/Sequence';
import { Repeat } from '../../src/runtime/actions/Repeat';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';
import { buildSpiralOffset, estimateSpiralDurationMs } from '../../src/runtime/patterns/movementPatterns';

function makeEntity(id = 'e1') {
  return { id, x: 200, y: 200, width: 10, height: 10, rotationDeg: 0 };
}

describe('SpiralPattern cycle', () => {
  test('outward then inward returns to the starting position each loop', () => {
    const maxRadius = 60;
    const revolutions = 2;
    const velocity = 80;
    const durationMs = estimateSpiralDurationMs({ maxRadius, revolutions, velocity });

    const entity = makeEntity();
    const startX = entity.x;
    const startY = entity.y;

    const outward = new ParametricMotionUntil(
      entity,
      buildSpiralOffset({ maxRadius, revolutions, direction: 'outward' }),
      new ElapsedTime(durationMs),
      { durationMs, rotateWithPath: false }
    );
    const inward = new ParametricMotionUntil(
      entity,
      buildSpiralOffset({ maxRadius, revolutions, direction: 'inward' }),
      new ElapsedTime(durationMs),
      { durationMs, rotateWithPath: false }
    );

    const loop = new Repeat(new Sequence([outward, inward]));
    loop.start();

    // Advance exactly one loop.
    loop.update(durationMs);
    loop.update(durationMs);

    expect(entity.x).toBeCloseTo(startX, 6);
    expect(entity.y).toBeCloseTo(startY, 6);
  });
});

