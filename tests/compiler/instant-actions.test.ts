import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function makeScene(attachment: SceneSpec['attachments'][string]): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 800, height: 600 },
    entities: {
      e1: { id: 'e1', x: 10, y: 20, width: 10, height: 10 },
    },
    groups: {},
    attachments: {
      att1: attachment,
    },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('instant actions', () => {
  it('MoveTo sets absolute position immediately', () => {
    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'MoveTo',
      params: { x: 100, y: 200 },
    });

    const compiled = compileScene(scene);
    compiled.startAll();

    expect(compiled.entities.e1.x).toBe(100);
    expect(compiled.entities.e1.y).toBe(200);
  });

  it('MoveBy offsets position immediately', () => {
    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'MoveBy',
      params: { dx: 5, dy: -7 },
    });

    const compiled = compileScene(scene);
    compiled.startAll();

    expect(compiled.entities.e1.x).toBe(15);
    expect(compiled.entities.e1.y).toBe(13);
  });
});

