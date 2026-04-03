import { ActionBase } from '../Action';
import { Condition } from '../conditions/Condition';
import { RuntimeEntity } from '../targets/types';

export class MoveUntil extends ActionBase {
  private targets: RuntimeEntity[];
  private velocity: { x: number; y: number };
  private condition: Condition;

  constructor(
    targets: RuntimeEntity[],
    velocity: { x: number; y: number },
    condition: Condition
  ) {
    super();
    this.targets = targets;
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
    if (this.condition.isMet(this.targets)) {
      this.complete = true;
      return;
    }

    const dtSeconds = dtMs / 1000;
    for (const target of this.targets) {
      target.x += this.velocity.x * dtSeconds;
      target.y += this.velocity.y * dtSeconds;
    }

    this.condition.update(dtMs);
    if (this.condition.isMet(this.targets)) {
      this.complete = true;
    }
  }

  reset(): void {
    super.reset();
    this.condition.reset();
  }
}
