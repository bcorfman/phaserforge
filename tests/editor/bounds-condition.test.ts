import { describe, expect, it } from 'vitest';
import { getEditableBoundsConditionId } from '../../src/editor/boundsCondition';
import { sampleScene } from '../../src/model/sampleScene';

describe('getEditableBoundsConditionId', () => {
  it('uses the selected MoveUntil attachment when it has an inline BoundsHit condition', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'attachment', id: 'att-move-right' })).toBe('att-move-right');
  });

  it('returns undefined when nothing relevant is selected', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'group', id: 'g-enemies' })).toBeUndefined();
  });
});
