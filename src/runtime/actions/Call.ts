import { ActionBase } from '../Action';

export class Call extends ActionBase {
  private callback: () => void;
  private fired = false;

  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (!this.fired) {
      this.callback();
      this.fired = true;
      this.complete = true;
    }
  }

  update(_dtMs: number): void {
    // no-op after start
  }

  reset(): void {
    super.reset();
    this.fired = false;
  }
}
