import { describe, expect, it } from 'vitest';
import { dissolveGroup, makeGridLayout, removeEntityFromGroup, updateGroupLayoutPosition } from '../../src/editor/groupCommands';
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

  it('retargets behaviors and actions when a group is dissolved', () => {
    const next = dissolveGroup(sampleScene, 'g-enemies');

    expect(next.groups['g-enemies']).toBeUndefined();
    expect(next.behaviors['b-formation'].target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(next.actions['a-move-right'].target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(next.actions['a-drop-right'].target).toEqual({ type: 'entity', entityId: 'e1' });
  });
});
