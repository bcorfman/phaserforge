import { Condition } from './Condition';
import { RuntimeEntity } from '../targets/types';

export class ElapsedTime implements Condition {
  private durationMs: number;
  private elapsedMs = 0;

  constructor(durationMs: number) {
    this.durationMs = durationMs;
  }

  reset(): void {
    this.elapsedMs = 0;
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
  }

  isMet(_targets: RuntimeEntity[]): boolean {
    return this.elapsedMs >= this.durationMs;
  }
}
