import { ActionBase, type Action } from '../Action';
import type { Condition } from '../conditions/Condition';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class HoldUntil extends ActionBase {
  constructor(
    private readonly inner: Action,
    private readonly condition: Condition,
    private readonly targets: RuntimeTarget | RuntimeEntity[]
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.inner.reset?.();
    this.inner.start();
    if (this.condition.isMet(this.targets)) this.stop();
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    if (!this.inner.isComplete()) this.inner.update(dtMs);
    this.condition.update(dtMs);
    if (this.condition.isMet(this.targets)) this.stop();
  }

  stop(): void {
    this.inner.stop?.();
    this.inner.cancel?.();
    super.stop();
  }

  reset(): void {
    super.reset();
    this.inner.reset?.();
    this.condition.reset();
  }
}

