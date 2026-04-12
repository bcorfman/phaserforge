import { ActionBase } from '../Action';
import { Condition } from '../conditions/Condition';
import { BoundsHit } from '../conditions/BoundsHit';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class MoveUntil extends ActionBase {
  private target: RuntimeTarget;
  private velocity: { x: number; y: number };
  private condition: Condition;

  constructor(
    targets: RuntimeTarget | RuntimeEntity[],
    velocity: { x: number; y: number },
    condition: Condition
  ) {
    super();
    this.target = coerceTarget(targets);
    this.velocity = velocity;
    this.condition = condition;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    console.log('[MoveUntil.start]', { velocity: this.velocity, targetId: 'members' in this.target ? this.target.id : (this.target as any).id });
    this.setTargetVelocity(this.velocity);
    if (this.condition instanceof BoundsHit) {
      try {
        this.condition.validateTarget(this.target);
      } catch (error) {
        console.warn('[MoveUntil] BoundsHit validation failed; continuing anyway', error);
      }
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;
    this.translateTarget(dtSeconds);

    this.condition.update(dtMs);
    if (this.condition instanceof BoundsHit) {
      const velocitiesBefore = this.getVelocitySnapshot();
      const hit = this.condition.apply(this.target);
      if (hit.hit && this.isTerminalBoundaryBehavior() && this.isMovingIntoBoundary(hit.sides, velocitiesBefore)) {
        console.log('[MoveUntil] completed due to boundary hit');
        this.complete = true;
      }
      return;
    }

    if (this.condition.isMet(this.target)) {
      console.log('[MoveUntil] completed due to condition met');
      this.complete = true;
    }
  }

  reset(): void {
    super.reset();
    this.condition.reset();
  }

  private setTargetVelocity(velocity: { x: number; y: number }): void {
    console.log('[setTargetVelocity]', { velocity, hasMembers: 'members' in this.target });
    if ('members' in this.target) {
      console.log('[setTargetVelocity] calling group.setVelocity', { gid: this.target.id, vx: velocity.x, vy: velocity.y });
      this.target.setVelocity(velocity.x, velocity.y);
      return;
    }

    console.log('[setTargetVelocity] setting entity velocity', { eid: (this.target as any).id, vx: velocity.x, vy: velocity.y });
    this.target.vx = velocity.x;
    this.target.vy = velocity.y;
  }

  private translateTarget(dtSeconds: number): void {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      const dx = (target.vx ?? 0) * dtSeconds;
      const dy = (target.vy ?? 0) * dtSeconds;
      if (dx !== 0 || dy !== 0) {
        console.log('[translateTarget]', { targetId: target.id, x: target.x, y: target.y, vx: target.vx, vy: target.vy, dtSeconds, dx, dy });
      }
      target.x += dx;
      target.y += dy;
    }
  }

  private isTerminalBoundaryBehavior(): boolean {
    return this.condition.behavior === 'stop' || this.condition.behavior === 'limit';
  }

  private getVelocitySnapshot(): Array<{ vx: number; vy: number }> {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    return targets.map((target) => ({ vx: target.vx ?? 0, vy: target.vy ?? 0 }));
  }

  private isMovingIntoBoundary(
    sides: { x?: 'left' | 'right'; y?: 'top' | 'bottom' },
    velocities: Array<{ vx: number; vy: number }>
  ): boolean {
    const xMovingInto = sides.x === 'left'
      ? velocities.some((velocity) => velocity.vx < 0)
      : sides.x === 'right'
        ? velocities.some((velocity) => velocity.vx > 0)
        : false;
    const yMovingInto = sides.y === 'bottom'
      ? velocities.some((velocity) => velocity.vy < 0)
      : sides.y === 'top'
        ? velocities.some((velocity) => velocity.vy > 0)
        : false;

    return xMovingInto || yMovingInto;
  }
}
