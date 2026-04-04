import { describe, expect, it } from 'vitest';
import { applyGroupGridLayout, inferGroupGridLayout } from '../../src/editor/formationLayout';
import { sampleScene } from '../../src/model/sampleScene';

describe('formation layout helpers', () => {
  it('infers editable grid layout from a grouped formation', () => {
    expect(inferGroupGridLayout(sampleScene, 'g-enemies')).toEqual({
      type: 'grid',
      rows: 3,
      cols: 5,
      startX: 220,
      startY: 140,
      spacingX: 48,
      spacingY: 40,
    });
  });

  it('applies a new grid layout to the group members in member order', () => {
    const next = applyGroupGridLayout(sampleScene, 'g-enemies', {
      rows: 5,
      cols: 3,
      startX: 300,
      startY: 120,
      spacingX: 20,
      spacingY: 25,
    });

    expect(next).not.toBe(sampleScene);
    expect(next.entities.e1.x).toBe(300);
    expect(next.entities.e1.y).toBe(120);
    expect(next.entities.e2.x).toBe(320);
    expect(next.entities.e2.y).toBe(120);
    expect(next.entities.e4.x).toBe(300);
    expect(next.entities.e4.y).toBe(145);
  });

  it('adds new formation members when the grid grows', () => {
    const next = applyGroupGridLayout(sampleScene, 'g-enemies', {
      rows: 4,
      cols: 4,
      startX: 300,
      startY: 120,
      spacingX: 20,
      spacingY: 25,
    });

    expect(next.groups['g-enemies'].members).toHaveLength(16);
    const addedId = next.groups['g-enemies'].members[15];
    expect(addedId).toBe('e16');
    expect(next.entities[addedId]).toMatchObject({
      id: 'e16',
      width: sampleScene.entities.e1.width,
      height: sampleScene.entities.e1.height,
      x: 360,
      y: 195,
    });
  });

  it('reuses the simplest available numeric id when regrowing after a shrink', () => {
    const shrunk = applyGroupGridLayout(sampleScene, 'g-enemies', {
      rows: 3,
      cols: 4,
      startX: 300,
      startY: 120,
      spacingX: 20,
      spacingY: 25,
    });
    const regrown = applyGroupGridLayout(shrunk, 'g-enemies', {
      rows: 3,
      cols: 5,
      startX: 300,
      startY: 120,
      spacingX: 20,
      spacingY: 25,
    });

    expect(regrown.groups['g-enemies'].members.slice(-3)).toEqual(['e13', 'e14', 'e15']);
  });

  it('removes surplus formation members when the grid shrinks', () => {
    const next = applyGroupGridLayout(sampleScene, 'g-enemies', {
      rows: 3,
      cols: 4,
      startX: 300,
      startY: 120,
      spacingX: 20,
      spacingY: 25,
    });

    expect(next.groups['g-enemies'].members).toHaveLength(12);
    expect(next.entities.e13).toBeUndefined();
    expect(next.entities.e14).toBeUndefined();
    expect(next.entities.e15).toBeUndefined();
  });
});
