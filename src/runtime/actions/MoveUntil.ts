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
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;

    if ('members' in this.target) {
      this.target.setVelocity(this.velocity.x, this.velocity.y);
      this.target.translate(this.velocity.x * dtSeconds, this.velocity.y * dtSeconds);
    } else {
      this.target.vx = this.velocity.x;
      this.target.vy = this.velocity.y;
      this.target.x += this.velocity.x * dtSeconds;
      this.target.y += this.velocity.y * dtSeconds;
    }

    this.condition.update(dtMs);
    const hitBoundary = this.condition instanceof BoundsHit ? this.condition.apply(this.target).hit : false;

    if (hitBoundary || this.condition.isMet(this.target)) {
      this.complete = true;
    }
  }

  reset(): void {
    super.reset();
    this.condition.reset();
  }
}
