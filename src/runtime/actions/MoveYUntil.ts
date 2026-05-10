import { ActionBase } from '../Action';
import { BoundsHit } from '../conditions/BoundsHit';
import { Condition } from '../conditions/Condition';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class MoveYUntil extends ActionBase {
  private target: RuntimeTarget;
  private velocityY: number;
  private condition: Condition;

  constructor(targets: RuntimeTarget | RuntimeEntity[], velocityY: number, condition: Condition) {
    super();
    this.target = coerceTarget(targets);
    this.velocityY = velocityY;
    this.condition = condition;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.setTargetVelocityY(this.velocityY);
    if (this.condition instanceof BoundsHit) {
      try {
        this.condition.validateTarget(this.target);
      } catch (error) {
        console.warn('[MoveYUntil] BoundsHit validation failed; continuing anyway', error);
      }
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;
    this.translateTargetY(dtSeconds);

    this.condition.update(dtMs);
    if (this.condition instanceof BoundsHit) {
      const velocitiesBefore = this.getVelocitySnapshot();
      const hit = this.condition.apply(this.target);
      if (hit.hit && this.isTerminalBoundaryBehavior() && this.isMovingIntoBoundaryY(hit.sides, velocitiesBefore)) {
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
      this.target.stopVelocity('y');
      return;
    }
    this.target.vy = 0;
  }

  private setTargetVelocityY(vy: number): void {
    if ('members' in this.target) {
      this.target.forEachMember((member) => {
        member.vy = vy;
      });
      return;
    }
    this.target.vy = vy;
  }

  private translateTargetY(dtSeconds: number): void {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      const dy = (target.vy ?? 0) * dtSeconds;
      if (dy !== 0) target.y += dy;
    }
  }

  private isTerminalBoundaryBehavior(): boolean {
    return this.condition.behavior === 'stop' || this.condition.behavior === 'limit';
  }

  private getVelocitySnapshot(): Array<{ vy: number }> {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    return targets.map((target) => ({ vy: target.vy ?? 0 }));
  }

  private isMovingIntoBoundaryY(sides: { x?: 'left' | 'right'; y?: 'top' | 'bottom' }, velocities: Array<{ vy: number }>): boolean {
    void sides.x;
    return sides.y === 'bottom'
      ? velocities.some((velocity) => velocity.vy < 0)
      : sides.y === 'top'
        ? velocities.some((velocity) => velocity.vy > 0)
        : false;
  }
}

