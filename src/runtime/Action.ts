export interface Action {
  start(): void;
  update(dtMs: number): void;
  isComplete(): boolean;
  cancel?(): void;
  reset?(): void;
}

export abstract class ActionBase implements Action {
  protected started = false;
  protected complete = false;
  protected cancelled = false;

  start(): void {
    if (this.started) return;
    this.started = true;
  }

  update(_dtMs: number): void {
    // default no-op
  }

  isComplete(): boolean {
    return this.complete || this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
  }

  reset(): void {
    this.started = false;
    this.complete = false;
    this.cancelled = false;
  }
}
