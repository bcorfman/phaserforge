import { describe, expect, it } from 'vitest';
import { parseProjectYaml, serializeProjectToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';

describe('project YAML serialization', () => {
  it('round-trips a minimal project spec', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        'scene-1': { ...sampleScene, backgroundLayers: [] },
      },
      initialSceneId: 'scene-1',
    };

    const yaml = serializeProjectToYaml(project);
    const parsed = parseProjectYaml(yaml);

    expect(parsed).toEqual(project);
  });
});
