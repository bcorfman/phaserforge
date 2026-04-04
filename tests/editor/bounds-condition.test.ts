import { describe, expect, it } from 'vitest';
import { getEditableBoundsConditionId } from '../../src/editor/boundsCondition';
import { sampleScene } from '../../src/model/sampleScene';

describe('getEditableBoundsConditionId', () => {
  it('uses the selected bounds condition when that condition is a BoundsHit', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'condition', id: 'c-bounds' })).toBe('c-bounds');
  });

  it('uses the selected MoveUntil action linked bounds condition', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'action', id: 'a-move-right' })).toBe('c-bounds');
  });

  it('returns undefined when nothing relevant is selected', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'behavior', id: 'b-formation' })).toBeUndefined();
  });
});
