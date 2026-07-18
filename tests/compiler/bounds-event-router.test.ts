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
    expect(compiled.debug?.lastDrainedEvents).toEqual([
      expect.objectContaining({
        family: 'bounds',
        outcome: 'contact-entered',
        sourceId: 'star1',
        axis: 'y',
        side: 'bottom',
        occurrenceId: 'evt-000001',
        occurrenceOrder: 1,
      }),
      expect.objectContaining({
        family: 'bounds',
        outcome: 'wrapped',
        sourceId: 'star1',
        axis: 'y',
        side: 'bottom',
        occurrenceId: 'evt-000002',
        occurrenceOrder: 2,
      }),
      expect.objectContaining({
        family: 'bounds',
        outcome: 'contact-exited',
        sourceId: 'star1',
        axis: 'y',
        side: 'bottom',
        occurrenceId: 'evt-000003',
        occurrenceOrder: 3,
      }),
    ]);
    expect(compiled.debug?.lastStartedEventScriptKeys).toEqual([
      'group:stars#wrap#bounds:wrapped:y:bottom',
    ]);
    expect(compiled.debug?.lastStartedEventContexts).toEqual([
      expect.objectContaining({
        family: 'bounds',
        outcome: 'wrapped',
        sourceId: 'star1',
        axis: 'y',
        side: 'bottom',
        occurrenceId: 'evt-000002',
        occurrenceOrder: 2,
      }),
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
    expect(compiled.debug?.lastStartedEventContexts).toEqual([
      expect.objectContaining({ family: 'bounds', outcome: 'wrapped', sourceId: 'star1', occurrenceId: 'evt-000002' }),
      expect.objectContaining({ family: 'bounds', outcome: 'wrapped', sourceId: 'star2', occurrenceId: 'evt-000005' }),
    ]);
    expect(compiled.entities.star1.x).not.toBe(100);
    expect(compiled.entities.star2.x).not.toBe(200);
  });

  it('ignores Bounds events outside the Event Block owner scope', () => {
    const scene = makeBoundsEventScene();
    scene.entities.other = { id: 'other', x: 320, y: -3, width: 10, height: 10 };
    scene.groups.otherStars = { id: 'otherStars', members: ['other'], layout: { type: 'freeform' } };
    scene.attachments.otherMove = {
      ...scene.attachments.move,
      id: 'otherMove',
      target: { type: 'group', groupId: 'otherStars' },
    };
    delete scene.attachments.move;

    const compiled = compileScene(scene);
    compiled.startAll();

    compiled.actionManager.update(0);
    compiled.updateTriggers(0);

    expect(compiled.debug?.lastDrainedEventNames).toEqual([
      'bounds:contact-entered',
      'bounds:wrapped',
      'bounds:contact-exited',
    ]);
    expect(compiled.debug?.lastStartedEventScriptKeys).toEqual([]);
    expect(compiled.entities.other.x).toBe(320);
  });

  it('preserves custom event name matching while carrying source context', () => {
    const scene = makeBoundsEventScene();
    scene.eventBlocks = {
      ping: {
        id: 'ping',
        target: { type: 'entity', entityId: 'star2' },
        trigger: { type: 'event', eventName: 'Stars.Ping' },
      },
    };
    scene.attachments = {
      emit: {
        id: 'emit',
        target: { type: 'entity', entityId: 'star1' },
        enabled: true,
        order: 0,
        presetId: 'EmitEvent',
        params: { eventName: 'Stars.Ping' },
      },
      setX: {
        id: 'setX',
        target: { type: 'entity', entityId: 'star2' },
        eventId: 'ping',
        enabled: true,
        order: 0,
        presetId: 'SetProperty',
        params: { property: 'x', valueSource: { kind: 'constant', value: 640 } },
      } as any,
    };

    const compiled = compileScene(scene);
    compiled.startAll();
    compiled.updateTriggers(0);

    expect(compiled.debug?.lastDrainedEventNames).toEqual(['Stars.Ping']);
    expect(compiled.debug?.lastStartedEventScriptKeys).toEqual(['entity:star2#ping#event:Stars.Ping']);
    expect(compiled.debug?.lastStartedEventContexts).toEqual([
      expect.objectContaining({ family: 'custom', type: 'Stars.Ping', sourceId: 'star1' }),
    ]);
    expect(compiled.entities.star2.x).toBe(640);
  });
});
