import { describe, expect, it } from 'vitest';
import { getPrimaryBoundsConditionId } from '../../src/editor/boundsCondition';
import { sampleScene } from '../../src/model/sampleScene';

describe('getPrimaryBoundsConditionId', () => {
  it('returns the first bounds condition id from the scene', () => {
    expect(getPrimaryBoundsConditionId(sampleScene)).toBe('c-bounds');
  });

  it('returns undefined when the scene has no bounds condition', () => {
    expect(
      getPrimaryBoundsConditionId({
        ...sampleScene,
        conditions: {},
      })
    ).toBeUndefined();
  });
});
