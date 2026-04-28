import { describe, expect, it } from 'vitest';
import { parseProjectYaml, serializeProjectToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';

describe('project YAML serialization', () => {
  it('round-trips a minimal project spec', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {} },
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
    };

    const yaml = serializeProjectToYaml(project);
    const parsed = parseProjectYaml(yaml);

    expect(parsed).toEqual(project);
  });

  it('drops sceneMeta entries that reference unknown scenes', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {} },
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
      assets: { images: {}, spriteSheets: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      baseSceneId: 'missing-scene',
    });

    expect(() => parseProjectYaml(yaml)).toThrow(/baseSceneId references unknown scene/);
  });
});
