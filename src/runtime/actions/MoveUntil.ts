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
    this.setTargetVelocity(this.velocity);
    if (this.condition instanceof BoundsHit) {
      this.condition.validateTarget(this.target);
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;
    this.translateTarget(dtSeconds);

    this.condition.update(dtMs);
    if (this.condition instanceof BoundsHit) {
      this.condition.apply(this.target);
      if (this.condition.isMet(this.target) && this.isTerminalBoundaryBehavior()) {
        this.complete = true;
      }
      return;
    }

    if (this.condition.isMet(this.target)) {
      this.complete = true;
    }
  }

  reset(): void {
    super.reset();
    this.condition.reset();
  }

  private setTargetVelocity(velocity: { x: number; y: number }): void {
    if ('members' in this.target) {
      this.target.setVelocity(velocity.x, velocity.y);
      return;
    }

    this.target.vx = velocity.x;
    this.target.vy = velocity.y;
  }

  private translateTarget(dtSeconds: number): void {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      target.x += (target.vx ?? 0) * dtSeconds;
      target.y += (target.vy ?? 0) * dtSeconds;
    }
  }

  private isTerminalBoundaryBehavior(): boolean {
    return this.condition.behavior === 'stop' || this.condition.behavior === 'limit';
  }
}
