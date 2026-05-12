import { ActionBase } from '../Action';
import type { VarsService } from '../services/RuntimeServices';

export class ClampCounter extends ActionBase {
  private fired = false;

  constructor(
    private readonly vars: VarsService,
    private readonly counterId: string,
    private readonly clamp: { min?: number; max?: number }
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (this.fired) return;
    this.vars.clampCounter(this.counterId, this.clamp);
    this.fired = true;
    this.complete = true;
  }

  reset(): void {
    super.reset();
    this.fired = false;
  }
}

