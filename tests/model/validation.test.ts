import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../../src/model/emptyProject';
import { validateProjectSpec, validateSceneSpec } from '../../src/model/validation';
import { baseScene } from '../helpers';

describe('model validation', () => {
  it('A1 valid scene spec passes', () => {
    const scene = baseScene();
    expect(() => validateSceneSpec(scene)).not.toThrow();
  });

  it('A2 missing rootAction fails', () => {
    const scene = baseScene();
    scene.behaviors.b1.rootActionId = 'missing';
    expect(() => validateSceneSpec(scene)).toThrow(/missing root action/i);
  });

  it('A3 invalid group member fails clearly', () => {
    const scene = baseScene();
    scene.groups.g1.members.push('ghost');
    expect(() => validateSceneSpec(scene)).toThrow(/unknown entity/i);
  });

  it('A4 action cycle detection', () => {
    const scene = baseScene();
    scene.actions.a1 = { id: 'a1', type: 'Sequence', children: ['a2'] };
    scene.actions.a2 = { id: 'a2', type: 'Sequence', children: ['a1'] };
    scene.behaviors.b1.rootActionId = 'a1';
    expect(() => validateSceneSpec(scene)).toThrow(/cycle/i);
  });

  it('A5 unknown action type fails', () => {
    const scene = baseScene();
    scene.actions.a1 = { id: 'a1', type: 'Mystery' as any };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown action type/i);
  });

  it('A6 invalid target reference fails', () => {
    const scene = baseScene();
    scene.behaviors.b1.target = { type: 'group', groupId: 'missing' };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown group/i);
  });

  it('A7 authored sprite properties validate and default correctly', () => {
    const scene = baseScene();
    scene.entities.e1.scaleX = 1.5;
    scene.entities.e1.scaleY = 0.75;
    scene.entities.e1.originX = 0.25;
    scene.entities.e1.originY = 0.75;
    scene.entities.e1.alpha = 0.4;
    scene.entities.e1.visible = false;
    scene.entities.e1.depth = 12;
    scene.entities.e1.flipX = true;
    scene.entities.e1.flipY = true;
    expect(() => validateSceneSpec(scene)).not.toThrow();
  });

  it('A8 invalid authored sprite property ranges fail clearly', () => {
    const scene = baseScene();
    scene.entities.e1.scaleX = 0;
    expect(() => validateSceneSpec(scene)).toThrow(/scale/i);

    scene.entities.e1.scaleX = 1;
    scene.entities.e1.originX = 2;
    expect(() => validateSceneSpec(scene)).toThrow(/origin/i);

    scene.entities.e1.originX = 0.5;
    scene.entities.e1.alpha = 2;
    expect(() => validateSceneSpec(scene)).toThrow(/alpha/i);
  });

  it('validates optional entity tint as an RGB integer', () => {
    const scene = baseScene();
    scene.entities.e1.tint = 0x123abc;
    expect(() => validateSceneSpec(scene)).not.toThrow();

    scene.entities.e1.tint = 0x1000000;
    expect(() => validateSceneSpec(scene)).toThrow(/tint/i);

    scene.entities.e1.tint = 1.5;
    expect(() => validateSceneSpec(scene)).toThrow(/tint/i);
  });

  it('validates optional scene backgroundColor as an RGB integer', () => {
    const scene = baseScene() as any;
    scene.backgroundColor = 0x000000;
    expect(() => validateSceneSpec(scene)).not.toThrow();

    scene.backgroundColor = -1;
    expect(() => validateSceneSpec(scene)).toThrow(/backgroundColor/i);
  });

  it('A9 hitbox must fit within entity dimensions', () => {
    const scene = baseScene();
    scene.entities.e1.hitbox = { x: 2, y: 2, width: 20, height: 20 };
    expect(() => validateSceneSpec(scene)).toThrow(/hitbox/i);
  });

  it('A10 Parallel validates children references', () => {
    const scene = baseScene();
    scene.actions.p1 = { id: 'p1', type: 'Parallel' as any, children: ['missing'] };
    scene.behaviors.b1.rootActionId = 'p1';
    expect(() => validateSceneSpec(scene)).toThrow(/parallel/i);
  });

  it('A11 cycle detection walks Parallel children', () => {
    const scene = baseScene();
    scene.actions.a1 = { id: 'a1', type: 'Parallel' as any, children: ['a2'] };
    scene.actions.a2 = { id: 'a2', type: 'Sequence', children: ['a1'] };
    scene.behaviors.b1.rootActionId = 'a1';
    expect(() => validateSceneSpec(scene)).toThrow(/cycle/i);
  });

  it('A12 attachments validate target references', () => {
    const scene = baseScene();
    scene.attachments = {
      att1: {
        id: 'att1',
        target: { type: 'group', groupId: 'missing' },
        presetId: 'Wait',
        enabled: true,
        order: 0,
        params: { durationMs: 10 },
      } as any,
    };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown group/i);
  });

  it('A13 attachments validate inline condition types', () => {
    const scene = baseScene();
    scene.attachments = {
      att1: {
        id: 'att1',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'MoveUntil',
        enabled: true,
        order: 0,
        condition: { type: 'Mystery' } as any,
      } as any,
    };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown type/i);
  });

  it('A14 attachments validate event block references', () => {
    const scene = baseScene();
    scene.eventBlocks = {
      ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any,
    };
    scene.attachments = {
      att1: {
        id: 'att1',
        target: { type: 'entity', entityId: 'e1' },
        eventId: 'missing',
        presetId: 'Wait',
        enabled: true,
        order: 0,
        params: { durationMs: 10 },
      } as any,
    };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown eventBlock/i);
  });

  it('A15 attachments validate event triggers', () => {
    const scene = baseScene();
    scene.eventBlocks = {
      ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'event', eventName: 'Coin.Collected' } } as any,
    };
    scene.attachments = {
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Wait', params: { durationMs: 10 } } as any,
    };
    expect(() => validateSceneSpec(scene)).not.toThrow();

    (scene.eventBlocks.ev1 as any).trigger = { type: 'event' };
    expect(() => validateSceneSpec(scene)).toThrow(/eventName/i);
  });

  it('A16 attachments validate Repeat composite nesting', () => {
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.eventBlocks = {
      ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any,
    };
    scene.attachments = {
      r1: { id: 'r1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Repeat', children: ['a1'] } as any,
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Wait', params: { durationMs: 1 }, parentAttachmentId: 'r1' } as any,
    };
    expect(() => validateSceneSpec(scene)).not.toThrow();

    (scene.attachments.r1 as any).children = ['missing'];
    expect(() => validateSceneSpec(scene)).toThrow(/unknown child/i);
  });

  it('validates SetProperty property and value-source compatibility', () => {
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.attachments = {
      a1: {
        id: 'a1',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'SetProperty',
        params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap' } },
      } as any,
      a2: {
        id: 'a2',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'SetProperty',
        params: { property: 'tint', valueSource: { kind: 'constant', value: 0x224466 } },
      } as any,
      a3: {
        id: 'a3',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'SetProperty',
        params: { property: 'x', valueSource: { kind: 'eventField', field: 'positionX' } },
      } as any,
    };
    expect(() => validateSceneSpec(scene)).not.toThrow();

    (scene.attachments.a2 as any).params = { property: 'visible', valueSource: { kind: 'randomRange', min: 0, max: 1, seed: 'bad' } };
    expect(() => validateSceneSpec(scene)).toThrow(/visible.*randomRange/i);

    (scene.attachments.a2 as any).params = { property: 'x', valueSource: { kind: 'eventField', field: 'side' } };
    expect(() => validateSceneSpec(scene)).toThrow(/eventField.*numeric/i);

    (scene.attachments.a2 as any).params = { property: 'visible', valueSource: { kind: 'eventField', field: 'positionX' } };
    expect(() => validateSceneSpec(scene)).toThrow(/visible.*eventField/i);
  });

  it('validates typed Bounds event triggers and event-source target binding', () => {
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.groups = { g1: { id: 'g1', members: ['e1'], layout: { type: 'freeform' } } };
    scene.eventBlocks = {
      ev1: {
        id: 'ev1',
        target: { type: 'group', groupId: 'g1' },
        trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'bottom' },
      } as any,
    };
    scene.attachments = {
      a1: {
        id: 'a1',
        target: { type: 'group', groupId: 'g1' },
        eventId: 'ev1',
        targetMode: 'event-source',
        presetId: 'SetProperty',
        params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap' } },
      } as any,
    };

    expect(() => validateSceneSpec(scene)).not.toThrow();

    (scene.eventBlocks.ev1 as any).trigger = { type: 'bounds', boundsEvent: 'teleported', axis: 'y' };
    expect(() => validateSceneSpec(scene)).toThrow(/boundsEvent/i);

    (scene.eventBlocks.ev1 as any).trigger = { type: 'bounds', boundsEvent: 'wrapped', axis: 'z' };
    expect(() => validateSceneSpec(scene)).toThrow(/axis/i);

    (scene.eventBlocks.ev1 as any).trigger = { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'bottom' };
    (scene.attachments.a1 as any).targetMode = 'script';
    expect(() => validateSceneSpec(scene)).toThrow(/targetMode/i);

    (scene.attachments.a1 as any).targetMode = 'event-source';
    (scene.attachments.a1 as any).eventId = undefined;
    (scene.attachments.a1 as any).trigger = { type: 'start' };
    expect(() => validateSceneSpec(scene)).toThrow(/event-source.*bounds/i);
  });

  it('A17 project validation allows cloud and path asset sources', () => {
    const project = createEmptyProject();
    project.assets.images.hero = {
      id: 'hero',
      width: 16,
      height: 16,
      source: {
        kind: 'cloud',
        assetId: 'asset-img-1',
        originalName: 'hero.png',
        mimeType: 'image/png',
      },
    } as any;
    project.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'path',
        path: 'assets/audio/theme.mp3',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any;

    expect(() => validateProjectSpec(project)).not.toThrow();
  });

  it('covers the supported inline condition families and rejects malformed values', () => {
    const scene = baseScene();
    const attachment = {
      id: 'a1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'Wait',
      params: { durationMs: 1 },
    } as any;
    scene.attachments = { a1: attachment };

    for (const condition of [
      { type: 'BoundsHit', bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 } },
      { type: 'ElapsedTime', durationMs: 0 },
      { type: 'Instant' },
      { type: 'CounterCompare', counterId: 'score', value: 10, op: '==' },
      { type: 'CounterCompare', counterId: 'score', value: 10, op: '>=' },
      { type: 'CounterCompare', counterId: 'score', value: 10, op: '<=' },
      { type: 'InputActionEdge', actionId: 'jump', edge: 'pressed' },
      { type: 'InputActionEdge', actionId: 'jump', edge: 'released' },
    ]) {
      attachment.condition = condition;
      expect(() => validateSceneSpec(scene)).not.toThrow();
    }

    const invalidConditions = [
      { type: 'BoundsHit', bounds: { minX: 'bad', maxX: 10, minY: 0, maxY: 10 } },
      { type: 'ElapsedTime', durationMs: -1 },
      { type: 'CounterCompare', counterId: '', value: 1, op: '==' },
      { type: 'CounterCompare', counterId: 'score', value: 'bad', op: '==' },
      { type: 'CounterCompare', counterId: 'score', value: 1, op: '!=' },
      { type: 'InputActionEdge', actionId: '', edge: 'pressed' },
      { type: 'InputActionEdge', actionId: 'jump', edge: 'held' },
    ];
    for (const condition of invalidConditions) {
      attachment.condition = condition;
      expect(() => validateSceneSpec(scene)).toThrow();
    }
  });

  it('covers attachment trigger variants and attachment structure invariants', () => {
    const scene = baseScene();
    const attachment = {
      id: 'a1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'Wait',
      params: { durationMs: 1 },
    } as any;
    scene.attachments = { a1: attachment };

    for (const trigger of [
      { type: 'start' },
      { type: 'update' },
      { type: 'input_action', actionId: 'jump', edge: 'pressed' },
      { type: 'input_action', actionId: 'jump', edge: 'released' },
      { type: 'visible', edge: 'shown' },
      { type: 'visible', edge: 'hidden' },
      { type: 'event', eventName: 'Coin.Collected' },
      { type: 'bounds', boundsEvent: 'wrapped', axis: 'any', side: 'any' },
    ]) {
      attachment.trigger = trigger;
      expect(() => validateSceneSpec(scene)).not.toThrow();
    }

    for (const trigger of [
      { type: 'input_action', actionId: '', edge: 'pressed' },
      { type: 'input_action', actionId: 'jump', edge: 'held' },
      { type: 'visible', edge: 'shown-or-hidden' },
      { type: 'event', eventName: '' },
      { type: 'bounds', boundsEvent: 'unknown' },
      { type: 'bounds', boundsEvent: 'wrapped', axis: 'z' },
      { type: 'bounds', boundsEvent: 'wrapped', side: 'diagonal' },
      { type: 'unknown' },
    ]) {
      attachment.trigger = trigger;
      expect(() => validateSceneSpec(scene)).toThrow();
    }

    attachment.trigger = { type: 'start' };
    attachment.id = 'wrong';
    expect(() => validateSceneSpec(scene)).toThrow(/id mismatch/i);
    attachment.id = 'a1';
    attachment.applyTo = 'invalid';
    expect(() => validateSceneSpec(scene)).toThrow(/applyTo/i);
    attachment.applyTo = undefined;
    attachment.targetMode = 'invalid';
    expect(() => validateSceneSpec(scene)).toThrow(/targetMode/i);
  });

  it('covers collision and trigger-zone validation and composite attachment invariants', () => {
    const scene = baseScene() as any;
    scene.collisionRules = [{
      id: 'c1',
      a: { type: 'layer', layer: 'player' },
      b: { type: 'layer', layer: 'enemy' },
      interaction: 'block',
      onEnter: [{ callId: 'hit', args: {} }],
    }];
    scene.triggers = [{ id: 'z1', rect: { x: 0, y: 0, width: 10, height: 10 } }];
    expect(() => validateSceneSpec(scene)).not.toThrow();

    scene.collisionRules[0].onEnter = { callId: 'hit' };
    expect(() => validateSceneSpec(scene)).not.toThrow();
    scene.collisionRules[0].onEnter = { callId: '', args: [] };
    expect(() => validateSceneSpec(scene)).toThrow();
    scene.collisionRules = 'bad';
    expect(() => validateSceneSpec(scene)).toThrow(/collisionRules/i);
    scene.collisionRules = [];
    scene.triggers = [{ id: 'z1', rect: { x: 0, y: 0, width: 0, height: 10 } }];
    expect(() => validateSceneSpec(scene)).toThrow(/positive/i);

    scene.triggers = [];
    scene.attachments = {
      r1: { id: 'r1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Repeat', children: ['a1'] },
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', parentAttachmentId: 'r1' },
    };
    expect(() => validateSceneSpec(scene)).not.toThrow();
    scene.attachments.r1.children = ['a1', 'a1'];
    expect(() => validateSceneSpec(scene)).toThrow(/duplicates/i);
    scene.attachments.r1.children = [];
    scene.attachments.a1.parentAttachmentId = 'missing';
    expect(() => validateSceneSpec(scene)).toThrow(/unknown parent/i);
    scene.attachments.a1.parentAttachmentId = 'r1';
    scene.attachments.r1.children = [];
    expect(() => validateSceneSpec(scene)).toThrow(/must include/i);
    scene.attachments.r1.children = ['a1'];
    scene.attachments.a1.parentAttachmentId = undefined;
    expect(() => validateSceneSpec(scene)).toThrow(/parentAttachmentId/i);
  });
});
