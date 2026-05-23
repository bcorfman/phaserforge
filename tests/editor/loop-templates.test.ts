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

  it('does not treat __legacy__ as a real event id', () => {
    let now = 2000;
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
            eventBlocks: {},
          },
        },
      },
      currentSceneId: sceneId,
    };

    const next = reducer(seeded as any, {
      type: 'apply-loop-template',
      templateId: 'loops:intro_then_repeat',
      target: { type: 'entity', entityId: 'e1' },
      eventId: '__legacy__',
    } as any);

    const nextScene = sceneOf(next);
    const atts = Object.values(nextScene.attachments ?? {}) as any[];
    expect(atts).toHaveLength(3);
    expect(atts.every((a) => (a.eventId ?? undefined) === undefined)).toBe(true);
  });

  it('expands repeat_with_children into a repeat with N seeded children', () => {
    let now = 3000;
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
      templateId: 'loops:repeat_with_children',
      target: { type: 'entity', entityId: 'e1' },
      eventId: 'ev1',
      opts: { childCount: 2, childPresetId: 'Call' },
    } as any);

    const nextScene = sceneOf(next);
    const atts = Object.values(nextScene.attachments ?? {}) as any[];
    const repeat = atts.find((a) => a.presetId === 'Repeat');
    expect(repeat).toBeTruthy();
    const children = atts.filter((a) => a.parentAttachmentId === repeat.id);
    expect(children).toHaveLength(2);
    expect(children.every((a) => a.presetId === 'Call')).toBe(true);
    expect(children.every((a) => a.condition?.type === 'Instant')).toBe(true);
  });
});
