import { describe, expect, it } from 'vitest';
import { createDisplayObjectAdapter, syncEntityToDisplay } from '../../src/runtime/adapters/display';
import { createNoopPhysicsAdapter } from '../../src/runtime/adapters/physics';
import { RuntimeEntity } from '../../src/runtime/targets/types';

describe('runtime adapters', () => {
  it('syncs runtime entity state to a display adapter', () => {
    const entity: RuntimeEntity = {
      id: 'e1',
      x: 12,
      y: 34,
      width: 10,
      height: 10,
      rotationDeg: 45,
      scaleX: 2,
      scaleY: 1.5,
      originX: 0.25,
      originY: 0.75,
      alpha: 0.5,
      visible: false,
      depth: 4,
      flipX: true,
      flipY: false,
      homeX: 12,
      homeY: 34,
      vx: 0,
      vy: 0,
    };
    const display = createDisplayObjectAdapter();

    syncEntityToDisplay(entity, display);

    expect(display.x).toBe(12);
    expect(display.y).toBe(34);
    expect(display.angle).toBe(45);
    expect(display.scaleX).toBe(2);
    expect(display.scaleY).toBe(1.5);
    expect(display.originX).toBe(0.25);
    expect(display.originY).toBe(0.75);
    expect(display.alpha).toBe(0.5);
    expect(display.visible).toBe(false);
    expect(display.depth).toBe(4);
    expect(display.flipX).toBe(true);
    expect(display.flipY).toBe(false);
  });

  it('defines a noop physics adapter surface without altering entity state', () => {
    const entity: RuntimeEntity = {
      id: 'e1',
      x: 12,
      y: 34,
      width: 10,
      height: 10,
      homeX: 12,
      homeY: 34,
      vx: 0,
      vy: 0,
    };
    const physics = createNoopPhysicsAdapter();

    physics.setVelocity(entity, 50, -25);
    physics.stop(entity, 'x');

    expect(entity.vx).toBe(0);
    expect(entity.vy).toBe(-25);
  });
});
