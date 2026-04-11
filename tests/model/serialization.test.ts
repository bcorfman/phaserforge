import { describe, expect, it } from 'vitest';
import { parseSceneYaml, serializeSceneToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';

describe('scene YAML serialization', () => {
  it('round-trips a full scene spec', () => {
    const yaml = serializeSceneToYaml(sampleScene);
    const parsed = parseSceneYaml(yaml);

    expect(parsed).toEqual(sampleScene);
  });
});
