import { ActionBase } from '../Action';

export class Wait extends ActionBase {
  private durationMs: number;
  private elapsedMs = 0;

  constructor(durationMs: number) {
    super();
    this.durationMs = durationMs;
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.elapsedMs += dtMs;
    if (this.elapsedMs >= this.durationMs) {
      this.complete = true;
    }
  }

  reset(): void {
    super.reset();
    this.elapsedMs = 0;
  }
}
