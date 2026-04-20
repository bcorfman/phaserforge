import { describe, expect, it } from 'vitest';
import { parseProjectYaml, serializeProjectToYaml, importLegacySceneYamlToProject, serializeSceneToYaml } from '../../src/model/serialization';
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

  it('imports legacy scene YAML into a one-scene project', () => {
    const legacyYaml = serializeSceneToYaml(sampleScene);
    const imported = importLegacySceneYamlToProject(legacyYaml);
    expect(imported.id).toBe('project-1');
    expect(Object.keys(imported.scenes)).toHaveLength(1);
    const onlySceneId = Object.keys(imported.scenes)[0];
    expect(imported.initialSceneId).toBe(onlySceneId);
    expect(imported.scenes[onlySceneId]).toMatchObject(sampleScene);
  });
});
