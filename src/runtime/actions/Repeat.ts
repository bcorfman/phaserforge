import { Action, ActionBase, type ActionStartContext } from '../Action';

export class Repeat extends ActionBase {
  private child: Action;
  private count?: number;
  private iterations = 0;
  private activeContext?: ActionStartContext;

  constructor(child: Action, count?: number) {
    super();
    this.child = child;
    this.count = count;
  }

  start(context?: ActionStartContext): void {
    if (this.started) return;
    super.start(context);
    this.activeContext = context;
    this.child.start(context);
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.child.update(dtMs);
    if (!this.child.isComplete()) return;

    this.iterations += 1;
    if (this.count !== undefined && this.iterations >= this.count) {
      this.complete = true;
      return;
    }

    if (this.child.reset) this.child.reset();
    this.child.start(this.activeContext);
  }

  stop(): void {
    this.child.stop?.();
    this.child.cancel?.();
    super.stop();
  }

  reset(): void {
    super.reset();
    this.iterations = 0;
    this.activeContext = undefined;
    if (this.child.reset) this.child.reset();
  }
}
