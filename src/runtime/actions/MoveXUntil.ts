import { ActionBase } from '../Action';
import { BoundsHit } from '../conditions/BoundsHit';
import { Condition } from '../conditions/Condition';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class MoveXUntil extends ActionBase {
  private target: RuntimeTarget;
  private velocityX: number;
  private condition: Condition;

  constructor(targets: RuntimeTarget | RuntimeEntity[], velocityX: number, condition: Condition) {
    super();
    this.target = coerceTarget(targets);
    this.velocityX = velocityX;
    this.condition = condition;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.setTargetVelocityX(this.velocityX);
    if (this.condition instanceof BoundsHit) {
      try {
        this.condition.validateTarget(this.target);
      } catch (error) {
        console.warn('[MoveXUntil] BoundsHit validation failed; continuing anyway', error);
      }
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;
    this.translateTargetX(dtSeconds);

    this.condition.update(dtMs);
    if (this.condition instanceof BoundsHit) {
      const velocitiesBefore = this.getVelocitySnapshot();
      const hit = this.condition.apply(this.target);
      if (hit.hit && this.isTerminalBoundaryBehavior() && this.isMovingIntoBoundaryX(hit.sides, velocitiesBefore)) {
        this.stop();
      }
      return;
    }

    if (this.condition.isMet(this.target)) {
      this.stop();
    }
  }

  reset(): void {
    super.reset();
    this.condition.reset();
  }

  protected removeEffect(): void {
    if ('members' in this.target) {
      this.target.stopVelocity('x');
      return;
    }
    this.target.vx = 0;
  }

  private setTargetVelocityX(vx: number): void {
    if ('members' in this.target) {
      this.target.forEachMember((member) => {
        member.vx = vx;
      });
      return;
    }
    this.target.vx = vx;
  }

  private translateTargetX(dtSeconds: number): void {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      const dx = (target.vx ?? 0) * dtSeconds;
      if (dx !== 0) target.x += dx;
    }
  }

  private isTerminalBoundaryBehavior(): boolean {
    return this.condition.behavior === 'stop' || this.condition.behavior === 'limit';
  }

  private getVelocitySnapshot(): Array<{ vx: number }> {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    return targets.map((target) => ({ vx: target.vx ?? 0 }));
  }

  private isMovingIntoBoundaryX(sides: { x?: 'left' | 'right'; y?: 'top' | 'bottom' }, velocities: Array<{ vx: number }>): boolean {
    void sides.y;
    return sides.x === 'left'
      ? velocities.some((velocity) => velocity.vx < 0)
      : sides.x === 'right'
        ? velocities.some((velocity) => velocity.vx > 0)
        : false;
  }
}

