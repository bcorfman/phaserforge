import type { Condition } from './Condition';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class CounterCompare implements Condition {
  constructor(
    private readonly getValue: () => number,
    private readonly op: '==' | '>=' | '<=',
    private readonly target: number
  ) {}

  reset(): void {}

  update(_dtMs: number): void {}

  isMet(_targets: RuntimeTarget | RuntimeEntity[]): boolean {
    const current = this.getValue();
    if (this.op === '==') return current === this.target;
    if (this.op === '>=') return current >= this.target;
    return current <= this.target;
  }
}

