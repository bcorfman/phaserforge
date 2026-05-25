import { describe, expect, it } from 'vitest';
import { getEditableBoundsConditionId } from '../../src/editor/boundsCondition';
import { sampleScene } from '../../src/model/sampleScene';

describe('getEditableBoundsConditionId', () => {
  it('uses the selected MoveUntil attachment when it has an inline BoundsHit condition', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'attachment', id: 'att-move-right' })).toBe('att-move-right');
  });

  it('uses any selected attachment when it has an inline BoundsHit condition', () => {
    const scene = {
      ...sampleScene,
      attachments: {
        ...sampleScene.attachments,
        'att-bounce': {
          id: 'att-bounce',
          presetId: 'BouncePattern',
          target: { type: 'group', groupId: 'g-enemies' },
          enabled: true,
          params: { axis: 'both', velocityX: 120, velocityY: 60 },
          condition: {
            type: 'BoundsHit',
            bounds: { minX: 10, minY: 20, maxX: 30, maxY: 40 },
            mode: 'any',
            scope: 'group-extents',
            behavior: 'bounce',
          },
        } as any,
      },
    };
    expect(getEditableBoundsConditionId(scene as any, { kind: 'attachment', id: 'att-bounce' })).toBe('att-bounce');
  });

  it('returns undefined when nothing relevant is selected', () => {
    expect(getEditableBoundsConditionId(sampleScene, { kind: 'group', id: 'g-enemies' })).toBeUndefined();
  });
});
