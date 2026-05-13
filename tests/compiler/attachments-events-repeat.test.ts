import { describe, it, expect } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { SceneSpec } from '../../src/model/types';
import { OpRegistry } from '../../src/compiler/opRegistry';

function eventScene(): SceneSpec {
  return {
    id: 'scene-1',
    entities: {
      coin: { id: 'coin', x: 0, y: 0, width: 10, height: 10 },
      player: { id: 'player', x: 0, y: 0, width: 10, height: 10 },
    },
    groups: {},
    attachments: {
      // Emitter: on start emit event
      emit1: {
        id: 'emit1',
        target: { type: 'entity', entityId: 'coin' },
        presetId: 'EmitEvent',
        params: { eventName: 'Coin.Collected', points: 50 },
        enabled: true,
        order: 0,
      } as any,
      // Handler: waits for event, then calls op
      h1: {
        id: 'h1',
        target: { type: 'entity', entityId: 'player' },
        eventId: 'ev-player',
        presetId: 'Call',
        params: { callId: 'onCollected' },
        enabled: true,
        order: 0,
      } as any,
    },
    eventBlocks: {
      'ev-player': {
        id: 'ev-player',
        target: { type: 'entity', entityId: 'player' },
        trigger: { type: 'event', eventName: 'Coin.Collected' } as any,
      },
    },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('compile attachments: events + nested Repeat', () => {
  it('E1 emitted events trigger event scripts', () => {
    const scene = eventScene();
    const opRegistry = new OpRegistry();
    let called = 0;
    opRegistry.register('onCollected', () => {
      called += 1;
    });
    const compiled = compileScene(scene, { opRegistry });
    compiled.startAll();
    // Run the emitter (instant) then drain triggers, then run the handler.
    compiled.actionManager.update(0);
    compiled.updateTriggers(0);
    compiled.actionManager.update(0);
    expect(called).toBe(1);
  });

  it('E4 emitted events drain on next tick when updateTriggers runs before action updates', () => {
    const scene = eventScene();
    // Add a wait before emitting so the event is emitted during actionManager.update.
    scene.attachments.emit1 = {
      id: 'emit1',
      target: { type: 'entity', entityId: 'coin' },
      presetId: 'Wait',
      params: { durationMs: 0 },
      enabled: true,
      order: 0,
    } as any;
    (scene.attachments as any).emit2 = {
      id: 'emit2',
      target: { type: 'entity', entityId: 'coin' },
      presetId: 'EmitEvent',
      params: { eventName: 'Coin.Collected' },
      enabled: true,
      order: 1,
    } as any;

    const opRegistry = new OpRegistry();
    let called = 0;
    opRegistry.register('onCollected', () => {
      called += 1;
    });
    const compiled = compileScene(scene, { opRegistry });
    compiled.startAll();

    compiled.updateTriggers(0);
    compiled.actionManager.update(0);
    expect(called).toBe(0);
    compiled.updateTriggers(0);
    compiled.actionManager.update(0);
    expect(called).toBe(1);
  });

  it('E3 event handler can contain a Repeat composite', () => {
    const scene = eventScene();
    // Replace handler with repeat->call.
    scene.attachments = {
      emit1: (scene.attachments as any).emit1,
      r1: {
        id: 'r1',
        target: { type: 'entity', entityId: 'player' },
        eventId: 'ev-player',
        presetId: 'Repeat',
        params: { count: 2 },
        enabled: true,
        order: 0,
        children: ['c1'],
      } as any,
      c1: {
        id: 'c1',
        target: { type: 'entity', entityId: 'player' },
        eventId: 'ev-player',
        parentAttachmentId: 'r1',
        presetId: 'Call',
        params: { callId: 'onCollected' },
        enabled: true,
        order: 1,
      } as any,
    } as any;
    const opRegistry = new OpRegistry();
    let called = 0;
    opRegistry.register('onCollected', () => {
      called += 1;
    });
    const compiled = compileScene(scene, { opRegistry });
    compiled.startAll();
    compiled.updateTriggers(0);
    compiled.actionManager.update(0);
    compiled.updateTriggers(0);
    compiled.actionManager.update(0);
    expect(called).toBe(2);
  });

  it('E2 Repeat composites run their children in-order per iteration', () => {
    const scene: SceneSpec = {
      id: 'scene-1',
      entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
      groups: {},
      eventBlocks: {
        ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } as any },
      },
      attachments: {
        r1: { id: 'r1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Repeat', params: { count: 2 }, children: ['c1', 'c2'] } as any,
        c1: { id: 'c1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Wait', params: { durationMs: 0 }, parentAttachmentId: 'r1', order: 0 } as any,
        c2: { id: 'c2', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Call', params: { callId: 'tick' }, parentAttachmentId: 'r1', order: 1 } as any,
      },
      behaviors: {},
      actions: {},
      conditions: {},
    };

    const opRegistry = new OpRegistry();
    let ticks = 0;
    opRegistry.register('tick', () => {
      ticks += 1;
    });
    const compiled = compileScene(scene, { opRegistry });
    compiled.startAll();
    compiled.actionManager.update(0);
    compiled.actionManager.update(0);
    expect(ticks).toBe(2);
  });
});
