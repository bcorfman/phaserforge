import { describe, expect, it } from 'vitest';
import { validateSceneSpec } from '../../src/model/validation';
import { sampleScene } from '../../src/model/sampleScene';

describe('group layout validation', () => {
  it('accepts the sample scene grid metadata', () => {
    expect(() => validateSceneSpec(sampleScene)).not.toThrow();
  });

  it('rejects grid metadata whose capacity does not match members', () => {
    expect(() =>
      validateSceneSpec({
        ...sampleScene,
        groups: {
          ...sampleScene.groups,
          'g-enemies': {
            ...sampleScene.groups['g-enemies'],
            layout: {
              type: 'grid',
              rows: 4,
              cols: 4,
              startX: 220,
              startY: 140,
              spacingX: 48,
              spacingY: 40,
            },
          },
        },
      })
    ).toThrow('Group g-enemies grid layout does not match member count');
  });
});
