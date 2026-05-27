import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function makeScene(attachment: SceneSpec['attachments'][string]): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 800, height: 600 },
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10, vx: 0, vy: 0 },
    },
    groups: {},
    attachments: { att1: attachment },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('compileAttachments', () => {
  it('compiles TweenUntil and advances it via ActionManager.update()', () => {
    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'TweenUntil',
      params: { property: 'vy', from: 'current', endValue: -4, durationMs: 1000, easing: 'linear' },
    });

    const compiled = compileScene(scene);
    compiled.startAll();
    expect(compiled.actionManager.size()).toBe(1);

    compiled.actionManager.update(500);
    expect(compiled.entities.e1.vy).toBeCloseTo(-2, 5);
    expect(compiled.actionManager.size()).toBe(1);

    compiled.actionManager.update(500);
    expect(compiled.entities.e1.vy).toBeCloseTo(-4, 5);
    expect(compiled.actionManager.size()).toBe(0);
  });
});

