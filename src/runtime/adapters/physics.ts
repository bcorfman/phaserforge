import { RuntimeEntity } from '../targets/types';

export interface PhysicsAdapter {
  setVelocity(entity: RuntimeEntity, vx: number, vy: number): void;
  stop(entity: RuntimeEntity, axis?: 'x' | 'y'): void;
}

export function createNoopPhysicsAdapter(): PhysicsAdapter {
  return {
    setVelocity(entity: RuntimeEntity, vx: number, vy: number): void {
      entity.vx = vx;
      entity.vy = vy;
    },
    stop(entity: RuntimeEntity, axis?: 'x' | 'y'): void {
      if (!axis || axis === 'x') entity.vx = 0;
      if (!axis || axis === 'y') entity.vy = 0;
    },
  };
}
