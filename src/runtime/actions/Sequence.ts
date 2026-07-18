import { ActionBase, Action, type ActionStartContext } from '../Action';

export class Sequence extends ActionBase {
  private children: Action[];
  private index = 0;
  private activeContext?: ActionStartContext;

  constructor(children: Action[]) {
    super();
    this.children = children;
  }

  start(context?: ActionStartContext): void {
    if (this.started) return;
    super.start(context);
    this.activeContext = context;
    if (this.children.length === 0) {
      this.complete = true;
      return;
    }
    this.children[0].start(context);
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    let current = this.children[this.index];
    if (!current) {
      this.complete = true;
      return;
    }

    current.update(dtMs);
    while (current && current.isComplete()) {
      this.index += 1;
      const next = this.children[this.index];
      if (!next) {
        this.complete = true;
        return;
      }
      next.start(this.activeContext);
      current = next;
    }
  }

  stop(): void {
    // Stop all children deterministically to ensure effects are removed.
    for (const child of this.children) {
      child.stop?.();
      child.cancel?.();
    }
    super.stop();
  }

  reset(): void {
    super.reset();
    this.index = 0;
    this.activeContext = undefined;
    for (const child of this.children) {
      if (child.reset) child.reset();
    }
  }
}
