import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';
import { estimateSpiralDurationMs } from '../../src/runtime/patterns/movementPatterns';

function makeScene(attachment: SceneSpec['attachments'][string]): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 800, height: 600 },
    entities: {
      e1: { id: 'e1', x: 200, y: 200, width: 10, height: 10, rotationDeg: 0, flipX: false, flipY: false },
    },
    groups: {},
    attachments: { att1: attachment },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('SpiralPattern flip overrides', () => {
  it('forces flips during SpiralPattern and restores after the action completes', () => {
    const maxRadius = 60;
    const revolutions = 2;
    const velocity = 80;
    const durationMs = estimateSpiralDurationMs({ maxRadius, revolutions, velocity });

    const scene = makeScene({
      id: 'att1',
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      order: 0,
      presetId: 'SpiralPattern',
      params: { maxRadius, revolutions, velocity, direction: 'outward', flipX: true, flipY: true },
      condition: { type: 'ElapsedTime', durationMs } as any,
    } as any);

    const compiled = compileScene(scene);
    compiled.startAll();

    compiled.actionManager.update(durationMs * 0.1);
    expect(compiled.entities.e1.flipX).toBe(true);
    expect(compiled.entities.e1.flipY).toBe(true);

    compiled.actionManager.update(durationMs);
    expect(compiled.entities.e1.flipX).toBe(false);
    expect(compiled.entities.e1.flipY).toBe(false);
  });
});

