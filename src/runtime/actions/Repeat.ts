import { Action, ActionBase } from '../Action';

export class Repeat extends ActionBase {
  private child: Action;
  private count?: number;
  private iterations = 0;

  constructor(child: Action, count?: number) {
    super();
    this.child = child;
    this.count = count;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.child.start();
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
    this.child.start();
  }

  reset(): void {
    super.reset();
    this.iterations = 0;
    if (this.child.reset) this.child.reset();
  }
}
