import { describe, expect, it } from 'vitest';
import { getCommonResolvedEntityValue } from '../../src/editor/commonEntityValues';

describe('getCommonResolvedEntityValue', () => {
  it('returns same when all resolved values match (including defaults)', () => {
    const entities: any[] = [
      { id: 'a', x: 0, y: 0, width: 10, height: 10, scaleX: 2 },
      { id: 'b', x: 0, y: 0, width: 10, height: 10, scaleX: 2 },
      // scaleY omitted should resolve to default 1
      { id: 'c', x: 0, y: 0, width: 10, height: 10 },
    ];

    expect(getCommonResolvedEntityValue(entities as any, 'scaleX')).toEqual({ kind: 'mixed' });
    expect(getCommonResolvedEntityValue(entities.slice(0, 2) as any, 'scaleX')).toEqual({ kind: 'same', value: 2 });
    expect(getCommonResolvedEntityValue(entities.slice(0, 2) as any, 'scaleY')).toEqual({ kind: 'same', value: 1 });
  });

  it('returns mixed when any resolved value differs', () => {
    const entities: any[] = [
      { id: 'a', x: 0, y: 0, width: 10, height: 10, alpha: 1 },
      { id: 'b', x: 0, y: 0, width: 10, height: 10, alpha: 0.5 },
    ];
    expect(getCommonResolvedEntityValue(entities as any, 'alpha')).toEqual({ kind: 'mixed' });
  });

  it('returns same for booleans using defaults', () => {
    const entities: any[] = [
      { id: 'a', x: 0, y: 0, width: 10, height: 10, visible: true },
      { id: 'b', x: 0, y: 0, width: 10, height: 10 }, // default visible: true
    ];
    expect(getCommonResolvedEntityValue(entities as any, 'visible')).toEqual({ kind: 'same', value: true });
  });
});

