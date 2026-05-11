import { ActionBase } from '../Action';
import { Condition } from '../conditions/Condition';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class CallbackUntil extends ActionBase {
  private readonly targets: RuntimeTarget | RuntimeEntity[];
  private readonly condition: Condition;
  private readonly callback: () => void;
  private readonly intervalMs: number | null;
  private accumulatedMs = 0;

  constructor(opts: {
    targets: RuntimeTarget | RuntimeEntity[];
    condition: Condition;
    callback: () => void;
    secondsBetweenCalls?: number;
    maxCallsPerUpdate?: number;
  }) {
    super();
    this.targets = opts.targets;
    this.condition = opts.condition;
    this.callback = opts.callback;
    const secondsBetweenCalls = opts.secondsBetweenCalls;
    if (secondsBetweenCalls === undefined || secondsBetweenCalls === null) {
      this.intervalMs = null; // per-update (once)
    } else {
      const s = Number(secondsBetweenCalls);
      if (!Number.isFinite(s) || s < 0) throw new Error('CallbackUntil requires secondsBetweenCalls >= 0');
      this.intervalMs = s === 0 ? 0 : s * 1000;
    }
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.accumulatedMs = 0;
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.condition.update(dtMs);
    if (this.condition.isMet(this.targets)) {
      this.stop();
      return;
    }

    if (this.intervalMs === null) {
      this.callback();
      return;
    }

    if (this.intervalMs === 0) {
      this.callback();
      return;
    }

    this.accumulatedMs += dtMs;
    const maxCalls = 8;
    let calls = 0;
    while (this.accumulatedMs >= this.intervalMs && calls < maxCalls) {
      this.accumulatedMs -= this.intervalMs;
      this.callback();
      calls += 1;
    }
  }

  reset(): void {
    super.reset();
    this.accumulatedMs = 0;
    this.condition.reset();
  }
}
