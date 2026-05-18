import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import type { AttachmentSpec, EventBlockSpec } from '../../src/model/types';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('duplicate-entities clones attachments and handlers', () => {
  it('clones entity-targeted attachments and event blocks with remapped ids', () => {
    const base = initState();
    const sceneId = base.currentSceneId;
    const scene = base.project.scenes[sceneId];

    const withData = {
      ...base,
      project: {
        ...base.project,
        scenes: {
          ...base.project.scenes,
          [sceneId]: {
            ...scene,
            entities: {
              e1: { id: 'e1', x: 100, y: 100, width: 16, height: 16 },
            },
            groups: {},
            eventBlocks: {
              ev1: { id: 'ev1', name: 'On Start', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as EventBlockSpec,
            },
            attachments: {
              a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Repeat', eventId: 'ev1', children: ['a2'] } as AttachmentSpec,
              a2: { id: 'a2', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', parentAttachmentId: 'a1', eventId: 'ev1', params: { durationMs: 123 } } as AttachmentSpec,
            },
          },
        },
      },
      currentSceneId: sceneId,
    };

    const duplicated = reducer(withData as any, { type: 'duplicate-entities', entityIds: ['e1'] } as any);
    const nextScene = sceneOf(duplicated);
    const newEntityId = Object.keys(nextScene.entities).find((id) => id !== 'e1');
    expect(newEntityId).toBeTruthy();

    const clonedBlocks = Object.values(nextScene.eventBlocks ?? {}).filter((b: any) => b.target?.entityId === newEntityId);
    expect(clonedBlocks).toHaveLength(1);

    const clonedAtts = Object.values(nextScene.attachments ?? {}).filter((a: any) => a.target?.entityId === newEntityId);
    expect(clonedAtts).toHaveLength(2);
    const clonedRepeat = clonedAtts.find((a: any) => a.presetId === 'Repeat') as any;
    const clonedWait = clonedAtts.find((a: any) => a.presetId === 'Wait') as any;
    expect(clonedRepeat).toBeTruthy();
    expect(clonedWait).toBeTruthy();
    expect(clonedRepeat.children).toEqual([clonedWait.id]);
    expect(clonedWait.parentAttachmentId).toBe(clonedRepeat.id);
    expect(clonedWait.params.durationMs).toBe(123);
    expect(clonedWait.eventId).toBe(clonedRepeat.eventId);
    expect(clonedBlocks[0].id).toBe(clonedRepeat.eventId);
  });

  it('can omit handlers and/or behaviors via options', () => {
    const base = initState();
    const sceneId = base.currentSceneId;
    const scene = base.project.scenes[sceneId];
    const withData = {
      ...base,
      project: {
        ...base.project,
        scenes: {
          ...base.project.scenes,
          [sceneId]: {
            ...scene,
            entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
            groups: {},
            eventBlocks: { ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any },
            attachments: { a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', eventId: 'ev1' } as any },
          },
        },
      },
      currentSceneId: sceneId,
    };

    const noHandlers = reducer(withData as any, { type: 'duplicate-entities', entityIds: ['e1'], options: { includeHandlers: false } } as any);
    const nextScene = sceneOf(noHandlers);
    const newEntityId = Object.keys(nextScene.entities).find((id) => id !== 'e1')!;
    const clonedAtts = Object.values(nextScene.attachments ?? {}).filter((a: any) => a.target?.entityId === newEntityId);
    expect(clonedAtts).toHaveLength(1);
    expect((clonedAtts[0] as any).eventId).toBeUndefined();
    const clonedBlocks = Object.values(nextScene.eventBlocks ?? {}).filter((b: any) => b.target?.entityId === newEntityId);
    expect(clonedBlocks).toHaveLength(0);

    const noBehaviors = reducer(withData as any, { type: 'duplicate-entities', entityIds: ['e1'], options: { includeBehaviors: false } } as any);
    const nextScene2 = sceneOf(noBehaviors);
    const newEntityId2 = Object.keys(nextScene2.entities).find((id) => id !== 'e1')!;
    const clonedAtts2 = Object.values(nextScene2.attachments ?? {}).filter((a: any) => a.target?.entityId === newEntityId2);
    expect(clonedAtts2).toHaveLength(0);
  });
});

