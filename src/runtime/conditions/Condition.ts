import { RuntimeEntity } from '../targets/types';

export interface Condition {
  reset(): void;
  update(dtMs: number): void;
  isMet(targets: RuntimeEntity[]): boolean;
}
