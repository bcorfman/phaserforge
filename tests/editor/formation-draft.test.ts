import { describe, expect, test } from 'vitest';
import { computeFormationDraftPositions } from '../../src/editor/formationDraft';

describe('formationDraft', () => {
  test('grid draft centers around centerX/centerY', () => {
    const positions = computeFormationDraftPositions(
      { arrangeKind: 'grid', memberCount: 0, params: { rows: 3, cols: 4, spacing: 24, centerX: 512, centerY: 384 } },
      { width: 32, height: 32 }
    );

    expect(positions).toHaveLength(12);
    expect(positions[0]).toEqual({ x: 476, y: 360, width: 32, height: 32 });
    expect(positions[3]).toEqual({ x: 548, y: 360, width: 32, height: 32 });
    expect(positions[8]).toEqual({ x: 476, y: 408, width: 32, height: 32 });
  });

  test('line draft respects memberCount', () => {
    const positions = computeFormationDraftPositions(
      { arrangeKind: 'line', memberCount: 5, params: { startX: 10, startY: 20, spacing: 7 } },
      { width: 10, height: 12 }
    );
    expect(positions.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 10, y: 20 },
      { x: 17, y: 20 },
      { x: 24, y: 20 },
      { x: 31, y: 20 },
      { x: 38, y: 20 },
    ]);
  });

  test('scatter draft places integer members inside normalized bounds deterministically', () => {
    const draft = {
      arrangeKind: 'scatter',
      memberCount: 400,
      params: { minX: 720, maxX: 0, minY: 1285, maxY: 5, seed: 'stars-seed' },
    };
    const positions = computeFormationDraftPositions(draft, { width: 3, height: 3 });
    const again = computeFormationDraftPositions(draft, { width: 3, height: 3 });

    expect(positions).toHaveLength(200);
    expect(positions).toEqual(again);
    expect(positions.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true);
    expect(positions.every((p) => p.x >= 0 && p.x <= 720 && p.y >= 5 && p.y <= 1285)).toBe(true);
  });
});
