import { ActionBase } from '../Action';
import type { VarsService } from '../services/RuntimeServices';

export class SetCounter extends ActionBase {
  private fired = false;

  constructor(
    private readonly vars: VarsService,
    private readonly counterId: string,
    private readonly value: number
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (this.fired) return;
    this.vars.setCounter(this.counterId, this.value);
    this.fired = true;
    this.complete = true;
  }

  reset(): void {
    super.reset();
    this.fired = false;
  }
}

