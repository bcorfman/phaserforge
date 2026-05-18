import { describe, expect, it, vi } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('loop templates', () => {
  it('expands intro_then_repeat into placeholders + repeat tree', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1));

    const state = initState();
    const sceneId = state.currentSceneId;
    const scene = state.project.scenes[sceneId];
    const seeded = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [sceneId]: {
            ...scene,
            entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
            groups: {},
            attachments: {},
            eventBlocks: { ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any },
          },
        },
      },
      currentSceneId: sceneId,
    };

    const next = reducer(seeded as any, {
      type: 'apply-loop-template',
      templateId: 'loops:intro_then_repeat',
      target: { type: 'entity', entityId: 'e1' },
      eventId: 'ev1',
    } as any);

    const nextScene = sceneOf(next);
    const atts = Object.values(nextScene.attachments ?? {});
    expect(atts).toHaveLength(3);
    const intro = atts.find((a: any) => a.name === 'Intro step');
    const repeat = atts.find((a: any) => a.presetId === 'Repeat');
    const child = atts.find((a: any) => a.parentAttachmentId === (repeat as any)?.id);
    expect(intro).toBeTruthy();
    expect(repeat).toBeTruthy();
    expect(child).toBeTruthy();
    expect((repeat as any).children).toEqual([(child as any).id]);
    expect(next.selection).toEqual({ kind: 'attachment', id: (intro as any).id });
  });
});

