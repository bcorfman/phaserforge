import type { Condition } from './Condition';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class Never implements Condition {
  reset(): void {
    // stateless
  }

  update(_dtMs: number): void {
    // stateless
  }

  isMet(_target: RuntimeTarget | RuntimeEntity[]): boolean {
    return false;
  }
}

