import { describe, expect, it } from 'vitest';
import { arrangeGrid } from '../../src/model/formation';
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
