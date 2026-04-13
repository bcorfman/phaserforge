import { Action, ActionBase } from '../Action';

export class Parallel extends ActionBase {
  private readonly children: Action[];

  constructor(children: Action[]) {
    super();
    this.children = children;
  }

  start(): void {
    if (this.started) return;
    super.start();
    for (const child of this.children) {
      child.start();
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    for (const child of this.children) {
      child.update(dtMs);
    }
    if (this.children.every((child) => child.isComplete())) {
      this.complete = true;
    }
  }

  cancel(): void {
    if (this.cancelled) return;
    for (const child of this.children) {
      if (child.cancel) child.cancel();
    }
    super.cancel();
  }

  reset(): void {
    super.reset();
    for (const child of this.children) {
      if (child.reset) child.reset();
    }
  }
}

