import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function makeScene(attachment: SceneSpec['attachments'][string]): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 800, height: 600 },
    entities: {
      e1: { id: 'e1', x: 10, y: 20, width: 10, height: 10, rotationDeg: 0 },
    },
    groups: {},
    attachments: { att1: attachment },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('FigureEightPattern rotateWithPath', () => {
  it('defaults to rotating the sprite with the path', () => {
    const width = 80;
    const height = 60;
    const velocity = 100;
    const durationMs = (Math.PI * Math.max(Math.abs(width), Math.abs(height)) / velocity) * 1000;

    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'FigureEightPattern',
      params: { width, height, velocity },
    } as any);

    const compiled = compileScene(scene);
    compiled.startAll();
    compiled.actionManager.update(durationMs * 0.1);

    expect(Math.abs(compiled.entities.e1.rotationDeg)).toBeGreaterThan(1e-3);
  });

  it('can disable rotation with rotateWithPath=false', () => {
    const width = 80;
    const height = 60;
    const velocity = 100;
    const durationMs = (Math.PI * Math.max(Math.abs(width), Math.abs(height)) / velocity) * 1000;

    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'FigureEightPattern',
      params: { width, height, velocity, rotateWithPath: false },
    } as any);

    const compiled = compileScene(scene);
    compiled.startAll();
    compiled.actionManager.update(durationMs * 0.1);

    expect(compiled.entities.e1.rotationDeg).toBe(0);
  });
});

