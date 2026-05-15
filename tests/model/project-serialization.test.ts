import { describe, expect, it } from 'vitest';
import { parseProjectYaml, serializeProjectToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';
import { stringify } from 'yaml';

describe('project YAML serialization', () => {
  it('round-trips a minimal project spec (patterns canonical)', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: {
        sounds: {
          music_theme: { id: 'music_theme', source: { kind: 'path', path: '/assets/audio/theme.mp3' } },
          forest_ambience: { id: 'forest_ambience', source: { kind: 'embedded', dataUrl: 'data:audio/wav;base64,AAAA', originalName: 'forest.wav', mimeType: 'audio/wav' } },
        },
      },
      inputMaps: {},
      baseSceneId: 'scene-1',
      sceneMeta: {
        'scene-1': { name: 'Base', role: 'base' },
      },
      scenes: {
        'scene-1': {
          ...sampleScene,
          backgroundLayers: [],
          collisionRules: [
            {
              id: 'shot-hit',
              a: { type: 'layer', layer: 'shots' },
              b: { type: 'layer', layer: 'obstacles' },
              interaction: 'overlap',
              onEnter: [
                { callId: 'entity.destroy', args: { target: 'a' } },
                { callId: 'entity.destroy', args: { target: 'b' } },
              ],
            },
          ],
          music: { assetId: 'music_theme', loop: true, volume: 0.65, fadeMs: 250 },
          ambience: [{ assetId: 'forest_ambience', loop: true, volume: 0.35 }],
        },
      },
      initialSceneId: 'scene-1',
      patterns: {
        p1: {
          id: 'p1',
          name: 'Pattern 1',
          params: [],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
        },
        p2: {
          id: 'p2',
          name: 'Pattern 2',
          params: [{ id: 'p1', name: 'durationMs', type: 'number', default: 10 }],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
          source: { sceneId: 'scene-1', targetKind: 'entity' },
        },
      },
    };

    const yaml = serializeProjectToYaml(project);
    expect(yaml).toMatch(/\npatterns:\n/);
    expect(yaml).not.toMatch(/\nsnippets:\n/);
    expect(yaml).not.toMatch(/\nmacros:\n/);
    const parsed = parseProjectYaml(yaml);

    expect(parsed).toEqual(project);
  });

  it('loads legacy snippets/macros into patterns and serializes patterns only', () => {
    const legacyProjectYaml = stringify({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      snippets: {
        s1: {
          id: 's1',
          name: 'Snippet 1',
          kind: 'attachments',
          source: { sceneId: 'scene-1', targetKind: 'entity' },
          attachmentsTemplate: [{ presetId: 'Wait', params: { durationMs: 10 }, tag: 't-{{x}}' }],
        },
      },
      macros: {
        s1: {
          id: 's1',
          name: 'Macro wins on id collision',
          params: [{ id: 'x', name: 'x', type: 'string' }],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
        },
        m2: {
          id: 'm2',
          name: 'Macro 2',
          params: [],
          body: [{ presetId: 'Wait', params: { durationMs: 20 } }],
        },
      },
    } as any, { indent: 2, lineWidth: 0, minContentWidth: 0 });

    // This YAML includes legacy keys. parse should canonicalize to patterns.
    expect(legacyProjectYaml).toMatch(/\nsnippets:\n/);
    expect(legacyProjectYaml).toMatch(/\nmacros:\n/);

    const parsed = parseProjectYaml(legacyProjectYaml);
    expect(Object.keys(parsed.patterns ?? {}).length).toBe(3);
    expect(parsed.patterns?.s1?.name).toBe('Macro wins on id collision');
    expect(parsed.snippets).toBeUndefined();
    expect(parsed.macros).toBeUndefined();

    const reserialized = serializeProjectToYaml(parsed);
    expect(reserialized).toMatch(/\npatterns:\n/);
    expect(reserialized).not.toMatch(/\nsnippets:\n/);
    expect(reserialized).not.toMatch(/\nmacros:\n/);
  });

  it('drops sceneMeta entries that reference unknown scenes', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      sceneMeta: {
        'scene-1': { name: 'Known', role: 'stage' },
        'missing-scene': { name: 'Missing', role: 'wave' },
      },
    });

    const parsed = parseProjectYaml(yaml);
    expect(parsed.sceneMeta).toEqual({ 'scene-1': { name: 'Known', role: 'stage' } });
  });

  it('throws when baseSceneId references an unknown scene', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      baseSceneId: 'missing-scene',
    });

    expect(() => parseProjectYaml(yaml)).toThrow(/baseSceneId references unknown scene/);
  });
});
