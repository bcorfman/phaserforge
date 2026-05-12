import type { Condition } from './Condition';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';
import type { InputService } from '../services/RuntimeServices';

export class InputActionEdge implements Condition {
  private met = false;

  constructor(
    private readonly input: InputService,
    private readonly actionId: string,
    private readonly edge: 'pressed' | 'released'
  ) {}

  reset(): void {
    this.met = false;
  }

  update(_dtMs: number): void {
    const state = this.input.getActionState(this.actionId);
    if (this.edge === 'pressed' && state.pressed) this.met = true;
    if (this.edge === 'released' && state.released) this.met = true;
  }

  isMet(_targets: RuntimeTarget | RuntimeEntity[]): boolean {
    return this.met;
  }
}

