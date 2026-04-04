import { describe, expect, it } from 'vitest';
import { sampleScene } from '../../src/model/sampleScene';
import { validateSceneSpec } from '../../src/model/validation';

describe('world validation', () => {
  it('accepts a scene with positive world dimensions', () => {
    expect(() => validateSceneSpec(sampleScene)).not.toThrow();
  });

  it('rejects non-positive world dimensions', () => {
    expect(() =>
      validateSceneSpec({
        ...sampleScene,
        world: {
          width: 0,
          height: 768,
        },
      })
    ).toThrow('Scene world must have positive width and height');
  });
});
