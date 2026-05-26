import { describe, expect, it } from 'vitest';
import { formatActionDisplayName, formatActionTypeTag } from '../../src/editor/actionFormatting';

describe('actionFormatting', () => {
  it('strips trailing \" Pattern\" from action display names', () => {
    expect(formatActionDisplayName({ type: 'WavePattern', displayName: 'Wave Pattern', category: 'movement' })).toBe('Wave');
    expect(formatActionDisplayName({ type: 'FigureEightPattern', displayName: 'Figure-8 Pattern', category: 'movement' })).toBe('Figure-8');
  });

  it('strips trailing \" Pattern\" regardless of category', () => {
    expect(formatActionDisplayName({ type: 'SomeOther', displayName: 'Wave Pattern', category: 'other' })).toBe('Wave');
    expect(formatActionDisplayName({ type: 'SomeOther', displayName: 'Wave Pattern' })).toBe('Wave');
  });

  it('strips trailing \"Pattern\" from action type tags', () => {
    expect(formatActionTypeTag({ type: 'WavePattern', displayName: 'Wave Pattern', category: 'movement' })).toBe('Wave');
    expect(formatActionTypeTag({ type: 'ZigzagPattern', displayName: 'Zigzag Pattern', category: 'movement' })).toBe('Zigzag');
  });
});
