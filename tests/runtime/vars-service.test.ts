import { describe, expect, it } from 'vitest';
import { BasicVarsService } from '../../src/runtime/services/BasicVarsService';

describe('BasicVarsService', () => {
  it('supports derived counters from collection size', () => {
    const vars = new BasicVarsService({
      collections: {
        lasers: { id: 'lasers', members: [{ type: 'entity', entityId: 'a' }, { type: 'entity', entityId: 'b' }] } as any,
      },
      counters: {
        lasersCount: { id: 'lasersCount', scope: 'scene', value: 0, derivedFromCollectionId: 'lasers' } as any,
      },
    });

    expect(vars.getCounter('lasersCount')).toBe(2);
    vars.removeFromCollection('lasers', { type: 'entity', entityId: 'a' } as any);
    expect(vars.getCounter('lasersCount')).toBe(1);
    vars.addToCollection('lasers', { type: 'entity', entityId: 'c' } as any);
    expect(vars.getCounter('lasersCount')).toBe(2);
  });
});

