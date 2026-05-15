import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseScene } from '../helpers';
import { applyPatternToTargetAndEvent, createPatternFromAttachments } from '../../src/editor/patternCommands';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('patterns', () => {
  it('creates a pattern from selected attachments', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.attachments = {
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', params: { durationMs: 10 }, enabled: true, order: 0 } as any,
      a2: { id: 'a2', target: { type: 'entity', entityId: 'e1' }, presetId: 'Call', params: { callId: 'drop', dy: 3 }, enabled: true, order: 1 } as any,
    };
    const project: any = { id: 'project-1', assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} }, inputMaps: {}, scenes: { [scene.id]: scene }, initialSceneId: scene.id };

    const { project: nextProject, patternId } = createPatternFromAttachments(project, scene, ['a2', 'a1'], { name: 'My Pattern' });
    expect(patternId).toBe('pattern-1234');
    expect(nextProject.patterns[patternId].name).toBe('My Pattern');
    expect(nextProject.patterns[patternId].body.map((t: any) => t.presetId)).toEqual(['Wait', 'Call']);
  });

  it('applies a pattern into an event block and preserves nesting', () => {
    vi.spyOn(Date, 'now').mockReturnValue(999);
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.eventBlocks = {
      ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any,
    };
    scene.attachments = {
      r1: { id: 'r1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Repeat', enabled: true, order: 0, children: ['c1'] } as any,
      c1: { id: 'c1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', parentAttachmentId: 'r1', presetId: 'Wait', params: { durationMs: 1 }, enabled: true, order: 1 } as any,
    };
    const pattern: any = {
      id: 'p1',
      name: 'Nested',
      params: [],
      body: [
        { presetId: 'Repeat' },
        { presetId: 'Call', params: { callId: 'drop', dy: 2 }, parentIndex: 0 },
      ],
    };
    const result = applyPatternToTargetAndEvent(scene, { type: 'entity', entityId: 'e1' }, 'ev1', pattern, {});
    expect(result.error).toBeUndefined();
    const nextScene = result.scene;
    const addedRepeat = Object.values(nextScene.attachments).find((a: any) => a.presetId === 'Repeat' && a.id.startsWith('att-')) as any;
    expect(addedRepeat).toBeTruthy();
    expect(Array.isArray(addedRepeat.children)).toBe(true);
    const childId = addedRepeat.children[0];
    const child = nextScene.attachments[childId] as any;
    expect(child.parentAttachmentId).toBe(addedRepeat.id);
    expect(child.presetId).toBe('Call');
  });

  it('applies a parameterized pattern with substitution + type coercion', () => {
    vi.spyOn(Date, 'now').mockReturnValue(777);
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    const pattern: any = {
      id: 'p1',
      name: 'Param',
      params: [
        { id: 'duration', name: 'Duration', type: 'number' },
        { id: 'label', name: 'Label', type: 'string' },
        { id: 'enabled', name: 'Enabled', type: 'boolean' },
      ],
      body: [
        {
          presetId: 'Wait',
          name: 'Wait {{duration}}ms',
          tag: 't-{{label}}',
          params: { durationMs: '{{duration}}', note: '{{label}}', enabled: '{{enabled}}' },
        },
      ],
    };

    const result = applyPatternToTargetAndEvent(
      scene,
      { type: 'entity', entityId: 'e1' },
      undefined,
      pattern,
      { duration: '12', label: 'hello', enabled: 'true' }
    );
    expect(result.error).toBeUndefined();
    const created = Object.values(result.scene.attachments ?? {}).find((a: any) => a.id.startsWith('att-')) as any;
    expect(created).toBeTruthy();
    expect(created.name).toBe('Wait 12ms');
    expect(created.tag).toBe('t-hello');
    expect(created.params.durationMs).toBe(12);
    expect(created.params.note).toBe('hello');
    expect(created.params.enabled).toBe(true);
  });

  it('fails validation if a required param is missing and does not mutate the scene', () => {
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.attachments = {};
    const pattern: any = {
      id: 'p1',
      name: 'NeedsParam',
      params: [{ id: 'x', name: 'X', type: 'number' }],
      body: [{ presetId: 'Wait', params: { durationMs: '{{x}}' } }],
    };

    const result = applyPatternToTargetAndEvent(scene, { type: 'entity', entityId: 'e1' }, undefined, pattern, {});
    expect(result.error).toMatch(/missing/i);
    expect(result.scene).toBe(scene);
  });
});

