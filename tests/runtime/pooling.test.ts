import { describe, expect, it } from 'vitest';
import { createStubFormationAllocator } from '../../src/runtime/pooling/allocator';

describe('formation allocator seam', () => {
  it('defines acquire and release contracts without allocating pooled members yet', () => {
    const allocator = createStubFormationAllocator();

    const acquired = allocator.acquire(3);
    expect(acquired).toEqual([]);

    allocator.release(acquired);
    expect(allocator.activeCount()).toBe(0);
  });
});
