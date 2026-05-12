import type { Condition } from './Condition';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class Instant implements Condition {
  reset(): void {}
  update(_dtMs: number): void {}
  isMet(_targets: RuntimeTarget | RuntimeEntity[]): boolean {
    return true;
  }
}

