import { describe, expect, test } from 'vitest';
import { getPreferredTextResolution } from '../../src/phaser/textResolution';

describe('getPreferredTextResolution', () =>
{
    test('ceil non-integer DPR', () =>
    {
        expect(getPreferredTextResolution(1.5)).toBe(2);
    });

    test('clamps to [1,3]', () =>
    {
        expect(getPreferredTextResolution(0.5)).toBe(1);
        expect(getPreferredTextResolution(2)).toBe(2);
        expect(getPreferredTextResolution(4)).toBe(3);
    });
});

