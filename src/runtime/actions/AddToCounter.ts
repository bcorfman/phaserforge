import { ActionBase } from '../Action';
import type { VarsService } from '../services/RuntimeServices';

export class AddToCounter extends ActionBase {
  private fired = false;

  constructor(
    private readonly vars: VarsService,
    private readonly counterId: string,
    private readonly delta: number
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (this.fired) return;
    this.vars.addToCounter(this.counterId, this.delta);
    this.fired = true;
    this.complete = true;
  }

  reset(): void {
    super.reset();
    this.fired = false;
  }
}

