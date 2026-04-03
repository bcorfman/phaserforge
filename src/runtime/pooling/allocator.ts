import { RuntimeEntity } from '../targets/types';

export interface FormationAllocator {
  acquire(count: number): RuntimeEntity[];
  release(members: RuntimeEntity[]): void;
  activeCount(): number;
}

export function createStubFormationAllocator(): FormationAllocator {
  return {
    acquire(): RuntimeEntity[] {
      return [];
    },
    release(): void {
      // interface seam only
    },
    activeCount(): number {
      return 0;
    },
  };
}
