import { ActionBase, Action } from '../Action';

export class Sequence extends ActionBase {
  private children: Action[];
  private index = 0;

  constructor(children: Action[]) {
    super();
    this.children = children;
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (this.children.length === 0) {
      this.complete = true;
      return;
    }
    this.children[0].start();
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
      next.start();
      current = next;
    }
  }

  reset(): void {
    super.reset();
    this.index = 0;
    for (const child of this.children) {
      if (child.reset) child.reset();
    }
  }
}
