import { describe, expect, it, vi, afterEach } from 'vitest';
import { baseScene } from '../helpers';
import { createSnippetFromAttachments, applySnippetToTargetAndEvent } from '../../src/editor/snippetCommands';
import { createMacroFromAttachments, applyMacroToTargetAndEvent } from '../../src/editor/macroCommands';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('snippets + macros', () => {
  it('creates a snippet from selected attachments', () => {
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

    const { project: nextProject, snippetId } = createSnippetFromAttachments(project, scene, ['a2', 'a1'], { name: 'My Snip' });
    expect(snippetId).toBe('snippet-1234');
    expect(nextProject.snippets[snippetId].name).toBe('My Snip');
    expect(nextProject.snippets[snippetId].attachmentsTemplate.map((t: any) => t.presetId)).toEqual(['Wait', 'Call']);
  });

  it('applies a snippet into an event block and preserves nesting', () => {
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
    const snippet: any = {
      id: 's1',
      name: 'Nested',
      kind: 'attachments',
      attachmentsTemplate: [
        { presetId: 'Repeat' },
        { presetId: 'Call', params: { callId: 'drop', dy: 2 }, parentIndex: 0 },
      ],
    };
    const nextScene = applySnippetToTargetAndEvent(scene, { type: 'entity', entityId: 'e1' }, 'ev1', snippet);
    const addedRepeat = Object.values(nextScene.attachments).find((a: any) => a.presetId === 'Repeat' && a.id.startsWith('att-')) as any;
    expect(addedRepeat).toBeTruthy();
    expect(Array.isArray(addedRepeat.children)).toBe(true);
    const childId = addedRepeat.children[0];
    const child = nextScene.attachments[childId] as any;
    expect(child.parentAttachmentId).toBe(addedRepeat.id);
    expect(child.presetId).toBe('Call');
  });

  it('creates and applies a macro (expansion-only v1)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(555);
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.attachments = {
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', params: { durationMs: 10 }, enabled: true, order: 0 } as any,
    };
    const project: any = { id: 'project-1', assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} }, inputMaps: {}, scenes: { [scene.id]: scene }, initialSceneId: scene.id };

    const { project: nextProject, macroId } = createMacroFromAttachments(project, scene, ['a1'], { name: 'My Macro' });
    expect(nextProject.macros[macroId].name).toBe('My Macro');
    const nextScene = applyMacroToTargetAndEvent(scene, { type: 'entity', entityId: 'e1' }, undefined, nextProject.macros[macroId]);
    expect(Object.values(nextScene.attachments).some((a: any) => a.id.startsWith('att-') && a.presetId === 'Wait')).toBe(true);
  });
});

