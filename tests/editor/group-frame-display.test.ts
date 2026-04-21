import { describe, expect, it } from 'vitest';
import { getGroupFrameDisplay } from '../../src/editor/groupFrameDisplay';

describe('getGroupFrameDisplay', () => {
  it('hides frames for unselected formations', () => {
    expect(getGroupFrameDisplay({ kind: 'none' }, 'g-enemies')).toMatchObject({ showFrame: false, labelAlpha: 0.75 });
    expect(getGroupFrameDisplay({ kind: 'entity', id: 'e1' }, 'g-enemies')).toMatchObject({ showFrame: false, labelAlpha: 0.75 });
    expect(getGroupFrameDisplay({ kind: 'group', id: 'g-friends' }, 'g-enemies')).toMatchObject({ showFrame: false, labelAlpha: 0.75 });
  });

  it('hides labels for unselected formations', () => {
    expect(getGroupFrameDisplay({ kind: 'none' }, 'g-enemies')).toMatchObject({ showLabel: false });
    expect(getGroupFrameDisplay({ kind: 'entity', id: 'e1' }, 'g-enemies')).toMatchObject({ showLabel: false });
    expect(getGroupFrameDisplay({ kind: 'group', id: 'g-friends' }, 'g-enemies')).toMatchObject({ showLabel: false });
  });

  it('shows frames for the selected formation', () => {
    expect(getGroupFrameDisplay({ kind: 'group', id: 'g-enemies' }, 'g-enemies')).toMatchObject({ showFrame: true, showLabel: true, labelAlpha: 1 });
  });
});
