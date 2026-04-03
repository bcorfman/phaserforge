import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export interface Condition {
  reset(): void;
  update(dtMs: number): void;
  isMet(targets: RuntimeTarget | RuntimeEntity[]): boolean;
}
