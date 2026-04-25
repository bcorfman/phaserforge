import { describe, expect, it } from 'vitest';
import { dissolveGroup, insertEntitiesIntoGroup, makeGridLayout, removeEntityFromGroup, updateGroupLayoutPosition } from '../../src/editor/groupCommands';
import { sampleScene } from '../../src/model/sampleScene';

describe('group commands', () => {
  it('updates grid layout origin when a grid group moves', () => {
    const group = {
      ...sampleScene.groups['g-enemies'],
      layout: makeGridLayout(3, 5, 220, 140, 48, 40),
    };

    expect(updateGroupLayoutPosition(group, 10, -20).layout).toEqual(
      makeGridLayout(3, 5, 230, 120, 48, 40)
    );
  });

  it('removes a member from a group and marks the layout freeform', () => {
    const scene = {
      ...sampleScene,
      groups: {
        ...sampleScene.groups,
        'g-enemies': {
          ...sampleScene.groups['g-enemies'],
          layout: makeGridLayout(3, 5, 220, 140, 48, 40),
        },
      },
    };
    const next = removeEntityFromGroup(scene, 'g-enemies', 'e2');

    expect(next.groups['g-enemies'].members).not.toContain('e2');
    expect(next.groups['g-enemies'].layout).toEqual({ type: 'freeform' });
  });

  it('retargets group-targeted attachments when a group is dissolved', () => {
    const next = dissolveGroup(sampleScene, 'g-enemies');

    expect(next.groups['g-enemies']).toBeUndefined();
    expect(next.attachments['att-move-right'].target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(next.attachments['att-move-right'].applyTo).toBeUndefined();
  });

  it('inserts ungrouped entities into a group at the requested index', () => {
    const scene = {
      ...sampleScene,
      entities: {
        ...sampleScene.entities,
        e99: { ...sampleScene.entities.e1, id: 'e99', x: 0, y: 0 },
      },
    };
    const before = scene.groups['g-enemies'].members;
    const next = insertEntitiesIntoGroup(scene, 'g-enemies', ['e99'], 2);

    expect(next.groups['g-enemies'].members[2]).toBe('e99');
    expect(next.groups['g-enemies'].members).toHaveLength(before.length + 1);
    expect(next.groups['g-enemies'].layout).toEqual({ type: 'freeform' });
  });

  it('reorders existing group members when inserting into the same group', () => {
    const before = sampleScene.groups['g-enemies'].members;
    expect(before[0]).toBe('e1');
    expect(before).toContain('e5');

    const next = insertEntitiesIntoGroup(sampleScene, 'g-enemies', ['e5'], 0);
    expect(next.groups['g-enemies'].members[0]).toBe('e5');
    expect(next.groups['g-enemies'].members).toHaveLength(before.length);
  });

  it('dedupes entity ids when inserting into a group', () => {
    const scene = {
      ...sampleScene,
      entities: {
        ...sampleScene.entities,
        e99: { ...sampleScene.entities.e1, id: 'e99', x: 0, y: 0 },
      },
    };
    const next = insertEntitiesIntoGroup(scene, 'g-enemies', ['e99', 'e99', 'e99'], 1);
    expect(next.groups['g-enemies'].members.filter((id) => id === 'e99')).toHaveLength(1);
  });
});
