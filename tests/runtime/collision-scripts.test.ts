import { describe, expect, it } from 'vitest';
import { OpRegistry } from '../../src/compiler/opRegistry';
import { executeCollisionScripts } from '../../src/runtime/collisions/collisionScripts';

describe('collisionScripts', () => {
  it('invokes onEnter calls for collision enter events with a/b targeting', () => {
    const registry = new OpRegistry();
    const calls: Array<{ opId: string; target?: any; args?: any }> = [];

    registry.register('mock', (action) => {
      calls.push({ opId: 'mock', target: action.target, args: action.args });
    });
    registry.register('mock2', (action) => {
      calls.push({ opId: 'mock2', target: action.target, args: action.args });
    });

    const scene: any = {
      id: 'scene-1',
      world: { width: 800, height: 600 },
      entities: {},
      groups: {},
      attachments: {},
      behaviors: {},
      actions: {},
      conditions: {},
      collisionRules: [
        {
          id: 'r1',
          a: { type: 'layer', layer: 'shots' },
          b: { type: 'layer', layer: 'obstacles' },
          interaction: 'overlap',
          onEnter: [
            { callId: 'mock', args: { target: 'a' } },
            { callId: 'mock2', args: { target: 'other' } },
          ],
        },
      ],
    };

    const ctx: any = {
      scene,
      targets: {
        entities: {
          shot1: { id: 'shot1', x: 0, y: 0, width: 10, height: 10 },
          block1: { id: 'block1', x: 0, y: 0, width: 10, height: 10 },
        },
        groups: {},
      },
      options: { opRegistry: registry },
    };

    executeCollisionScripts(
      scene.collisionRules,
      [{ ruleId: 'r1', type: 'enter', aId: 'shot1', bId: 'block1', interaction: 'overlap' }] as any,
      registry,
      ctx
    );

    expect(calls).toEqual([
      { opId: 'mock', target: { type: 'entity', entityId: 'shot1' }, args: { target: 'a' } },
      { opId: 'mock2', target: { type: 'entity', entityId: 'block1' }, args: { target: 'other' } },
    ]);
  });

  it('ignores stay/exit collision events', () => {
    const registry = new OpRegistry();
    const calls: any[] = [];
    registry.register('mock', () => { calls.push('called'); });

    const scene: any = {
      id: 'scene-1',
      world: { width: 800, height: 600 },
      entities: {},
      groups: {},
      attachments: {},
      behaviors: {},
      actions: {},
      conditions: {},
      collisionRules: [
        {
          id: 'r1',
          a: { type: 'layer', layer: 'shots' },
          b: { type: 'layer', layer: 'obstacles' },
          interaction: 'overlap',
          onEnter: { callId: 'mock', args: { target: 'a' } },
        },
      ],
    };

    const ctx: any = { scene, targets: { entities: {}, groups: {} }, options: { opRegistry: registry } };

    executeCollisionScripts(
      scene.collisionRules,
      [
        { ruleId: 'r1', type: 'stay', aId: 'a', bId: 'b', interaction: 'overlap' },
        { ruleId: 'r1', type: 'exit', aId: 'a', bId: 'b', interaction: 'overlap' },
      ] as any,
      registry,
      ctx
    );

    expect(calls).toEqual([]);
  });
});

