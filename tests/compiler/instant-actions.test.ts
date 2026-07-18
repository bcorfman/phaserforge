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

  it('SetProperty sets an allowlisted property from a constant value', () => {
    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'SetProperty',
      params: { property: 'tint', valueSource: { kind: 'constant', value: 0x224466 } },
    } as any);

    const compiled = compileScene(scene);
    compiled.startAll();

    expect(compiled.entities.e1.tint).toBe(0x224466);
  });

  it('SetProperty resolves deterministic random ranges per target', () => {
    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'SetProperty',
      params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-seed' } },
    } as any);

    const first = compileScene(scene);
    first.startAll();
    const second = compileScene(scene);
    second.startAll();

    expect(first.entities.e1.x).toBeGreaterThanOrEqual(0);
    expect(first.entities.e1.x).toBeLessThanOrEqual(720);
    expect(first.entities.e1.x).toBe(second.entities.e1.x);
    expect(Number.isInteger(first.entities.e1.x)).toBe(false);
  });

  it('SetProperty random range streams are independent per action id', () => {
    const base = {
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'SetProperty',
      params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'same-seed' } },
    } as const;
    const first = compileScene(makeScene({ ...base, id: 'att1' } as any));
    const secondScene = makeScene({ ...base, id: 'att1' } as any);
    secondScene.attachments = { att2: { ...base, id: 'att2' } as any };
    const second = compileScene(secondScene);

    first.startAll();
    second.startAll();

    expect(first.entities.e1.x).not.toBe(second.entities.e1.x);
  });
});
