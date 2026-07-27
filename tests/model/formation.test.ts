import { describe, expect, it } from 'vitest';
import {
  arrangeArc,
  arrangeCircle,
  arrangeConcentricRings,
  arrangeCross,
  arrangeDiamond,
  arrangeGrid,
  arrangeHexagonalGrid,
  arrangeLine,
  arrangeTriangle,
  arrangeVFormation,
} from '../../src/model/formation';
import { EntitySpec } from '../../src/model/types';

function makeEntity(id: string): EntitySpec {
  return { id, x: 0, y: 0, width: 10, height: 10 };
}

describe('arrangeGrid', () => {
  it('creates a new grid with the requested row and column count', () => {
    const entities = arrangeGrid<EntitySpec>(undefined, {
      rows: 2,
      cols: 3,
      startX: 100,
      startY: 200,
      spacingX: 20,
      spacingY: 30,
      factory: (index) => makeEntity(`e${index + 1}`),
    });

    expect(entities).toHaveLength(6);
    expect(entities.map((entity) => [entity.id, entity.x, entity.y])).toEqual([
      ['e1', 100, 200],
      ['e2', 120, 200],
      ['e3', 140, 200],
      ['e4', 100, 230],
      ['e5', 120, 230],
      ['e6', 140, 230],
    ]);
  });

  it('arranges existing entities in place', () => {
    const entities = [makeEntity('e1'), makeEntity('e2'), makeEntity('e3'), makeEntity('e4')];

    const arranged = arrangeGrid(entities, {
      rows: 2,
      cols: 2,
      startX: 50,
      startY: 75,
      spacingX: 10,
      spacingY: 15,
    });

    expect(arranged).toBe(entities);
    expect(entities.map((entity) => [entity.x, entity.y])).toEqual([
      [50, 75],
      [60, 75],
      [50, 90],
      [60, 90],
    ]);
  });

  it('throws when existing entity count does not match rows times cols', () => {
    expect(() =>
      arrangeGrid([makeEntity('e1')], {
        rows: 2,
        cols: 2,
      })
    ).toThrow('entity count (1) does not match rows * cols (4)');
  });

  it('throws when creating without a factory', () => {
    expect(() =>
      arrangeGrid(undefined, {
        rows: 1,
        cols: 1,
      })
    ).toThrow('factory is required when creating a new grid');
  });
});

describe('formation layout families', () => {
  it('arranges line, circle, arc, and V formation positions', () => {
    expect(arrangeLine(undefined, { count: 3, startX: 10, startY: 20, spacing: 7, factory: (i) => makeEntity(`l${i}`) })
      .map(({ x, y }) => [x, y])).toEqual([[10, 20], [17, 20], [24, 20]]);

    expect(arrangeCircle(undefined, { count: 4, centerX: 10, centerY: 20, radius: 5, factory: (i) => makeEntity(`c${i}`) })
      .map(({ x, y }) => [Number(x.toFixed(6)), Number(y.toFixed(6))])).toEqual([[10, 25], [15, 20], [10, 15], [5, 20]]);

    expect(arrangeArc(undefined, { count: 3, centerX: 10, centerY: 20, radius: 5, startAngleDeg: 0, endAngleDeg: 180, factory: (i) => makeEntity(`a${i}`) })
      .map(({ x, y }) => [Number(x.toFixed(6)), Number(y.toFixed(6))])).toEqual([[15, 20], [10, 25], [5, 20]]);

    expect(arrangeVFormation(undefined, { count: 5, apexX: 10, apexY: 20, spacing: 4, direction: 'down', factory: (i) => makeEntity(`v${i}`) })
      .map(({ x, y }) => [x, y])).toEqual([[10, 20], [6, 16], [14, 16], [2, 12], [18, 12]]);
  });

  it('handles empty and single-item circular layouts', () => {
    const empty: EntitySpec[] = [];
    expect(arrangeCircle(empty)).toBe(empty);
    expect(arrangeArc(undefined, { count: 1, radius: 12, factory: () => makeEntity('one') })[0]).toMatchObject({ x: 12, y: 0 });
  });

  it('arranges diamond, triangle, and cross layouts with optional centers', () => {
    const diamond = arrangeDiamond([makeEntity('d1'), makeEntity('d2'), makeEntity('d3'), makeEntity('d4'), makeEntity('d5')], { spacing: 10 });
    expect(diamond.map(({ x, y }) => [x, y])).toEqual([[0, 0], [0, 10], [10, 0], [0, -10], [-10, 0]]);

    const triangle = arrangeTriangle([makeEntity('t1'), makeEntity('t2'), makeEntity('t3'), makeEntity('t4')], { rowSpacing: 8, lateralSpacing: 6, invert: true });
    expect(triangle.map(({ x, y }) => [x, y])).toEqual([[0, 0], [-3, -8], [3, -8], [-6, -16]]);

    const cross = arrangeCross([makeEntity('x1'), makeEntity('x2'), makeEntity('x3'), makeEntity('x4'), makeEntity('x5')], { spacing: 10, armLength: 15, includeCenter: false });
    expect(cross.map(({ x, y }) => [x, y])).toEqual([[10, 0], [-10, 0], [0, 10], [0, -10], [10, 0]]);
  });

  it('arranges hexagonal and concentric-ring layouts and validates ring inputs', () => {
    const hex = arrangeHexagonalGrid([makeEntity('h1'), makeEntity('h2'), makeEntity('h3'), makeEntity('h4')], { cols: 2, spacing: 10 });
    expect(hex.map(({ x, y }) => [Number(x.toFixed(6)), Number(y.toFixed(6))])).toEqual([[0, 0], [10, 0], [5, 8.660254], [15, 8.660254]]);

    const rings = arrangeConcentricRings([makeEntity('r1'), makeEntity('r2'), makeEntity('r3')], { radii: [10, 20], spritesPerRing: [1, 2] });
    expect(rings.map(({ x, y }) => [Number(x.toFixed(6)), Number(y.toFixed(6))])).toEqual([[0, 10], [0, 20], [0, -20]]);
    expect(() => arrangeConcentricRings([makeEntity('r1')], { radii: [10], spritesPerRing: [] })).toThrow(/same length/i);
  });
});
