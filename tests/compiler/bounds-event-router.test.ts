import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function makeBoundsEventScene(): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 720, height: 1280 },
    entities: {
      star1: { id: 'star1', x: 100, y: -2, width: 10, height: 10 },
      star2: { id: 'star2', x: 200, y: 100, width: 10, height: 10 },
    },
    groups: {
      stars: { id: 'stars', members: ['star1', 'star2'], layout: { type: 'freeform' } },
    },
    eventBlocks: {
      wrap: {
        id: 'wrap',
        target: { type: 'group', groupId: 'stars' },
        trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'bottom' },
      },
    },
    attachments: {
      move: {
        id: 'move',
        target: { type: 'group', groupId: 'stars' },
        applyTo: 'members',
        enabled: true,
        order: 0,
        presetId: 'MoveUntil',
        params: { velocityX: 0, velocityY: -240 },
        condition: {
          type: 'BoundsHit',
          bounds: { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
          mode: 'any',
          scope: 'member-any',
          behavior: 'wrap',
        },
      },
      rerollX: {
        id: 'rerollX',
        target: { type: 'group', groupId: 'stars' },
        targetMode: 'event-source',
        eventId: 'wrap',
        enabled: true,
        order: 0,
        presetId: 'SetProperty',
        params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-x' } },
      } as any,
    },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('typed bounds event router', () => {
  it('routes a filtered Bounds/Wrapped event to the exact event-source member', () => {
    const compiled = compileScene(makeBoundsEventScene());
    compiled.startAll();

    compiled.actionManager.update(0);
    compiled.updateTriggers(0);

    expect(compiled.debug?.lastDrainedEventNames).toEqual([
      'bounds:contact-entered',
      'bounds:wrapped',
      'bounds:contact-exited',
    ]);
    expect(compiled.debug?.lastStartedEventScriptKeys).toEqual([
      'group:stars#wrap#bounds:wrapped:y:bottom',
    ]);
    expect(compiled.entities.star1.y).toBe(1275);
    expect(compiled.entities.star1.x).toBeGreaterThanOrEqual(0);
    expect(compiled.entities.star1.x).toBeLessThanOrEqual(720);
    expect(compiled.entities.star1.x).not.toBe(100);
    expect(compiled.entities.star2.x).toBe(200);
  });

  it('does not discard a second member Bounds/Wrapped occurrence in the same tick', () => {
    const scene = makeBoundsEventScene();
    scene.entities.star2 = { ...scene.entities.star2, y: -4 };
    const compiled = compileScene(scene);
    compiled.startAll();

    compiled.actionManager.update(0);
    compiled.updateTriggers(0);

    expect(compiled.debug?.lastStartedEventScriptKeys).toEqual([
      'group:stars#wrap#bounds:wrapped:y:bottom',
      'group:stars#wrap#bounds:wrapped:y:bottom',
    ]);
    expect(compiled.entities.star1.x).not.toBe(100);
    expect(compiled.entities.star2.x).not.toBe(200);
  });
});
