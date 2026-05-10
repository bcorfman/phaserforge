export interface Action {
  start(): void;
  update(dtMs: number): void;
  isComplete(): boolean;
  stop?(): void;
  cancel?(): void;
  reset?(): void;
}

export abstract class ActionBase implements Action {
  protected started = false;
  protected complete = false;
  protected cancelled = false;
  private stopped = false;
  private effectRemoved = false;

  start(): void {
    if (this.started) return;
    this.started = true;
  }

  update(_dtMs: number): void {
    // default no-op
  }

  isComplete(): boolean {
    return this.complete || this.cancelled || this.stopped;
  }

  protected removeEffect(): void {
    // no-op by default
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.complete = true;
    if (!this.effectRemoved) {
      this.effectRemoved = true;
      this.removeEffect();
    }
  }

  cancel(): void {
    // Backward-compatible alias for stop semantics.
    this.cancelled = true;
    this.stop();
  }

  reset(): void {
    this.started = false;
    this.complete = false;
    this.cancelled = false;
    this.stopped = false;
    this.effectRemoved = false;
  }
}
