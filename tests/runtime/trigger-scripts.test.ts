import { describe, expect, it } from 'vitest';
import { OpRegistry } from '../../src/compiler/opRegistry';
import { executeTriggerScripts } from '../../src/runtime/triggers/triggerScripts';

describe('executeTriggerScripts', () => {
  it('invokes the trigger onEnter op with the instigator entity as the Call target', () => {
    const triggers = [
      {
        id: 't1',
        rect: { x: 0, y: 0, width: 10, height: 10 },
        onEnter: { callId: 'test.op', args: { a: 1 } },
      },
    ];
    const events = [{ id: 't1', type: 'enter', entityId: 'e1' }] as any[];

    const seen: any[] = [];
    const registry = new OpRegistry();
    registry.register('test.op', (action, ctx) => {
      seen.push({ action, ctx });
    });

    executeTriggerScripts(
      triggers as any,
      events as any,
      registry,
      {
        scene: { id: 'scene-1', entities: {}, groups: {}, actions: {}, behaviors: {}, attachments: {}, conditions: {} } as any,
        targets: { entities: { e1: { id: 'e1', x: 0, y: 0, width: 1, height: 1 } }, groups: {} } as any,
        options: { opRegistry: registry },
      } as any,
    );

    expect(seen).toHaveLength(1);
    expect(seen[0].action.callId).toBe('test.op');
    expect(seen[0].action.target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(seen[0].action.args).toEqual({ a: 1 });
  });

  it('prefers args.entityId as an explicit target override', () => {
    const triggers = [
      {
        id: 't1',
        rect: { x: 0, y: 0, width: 10, height: 10 },
        onEnter: { callId: 'test.op', args: { entityId: 'e2' } },
      },
    ];
    const events = [{ id: 't1', type: 'enter', entityId: 'e1' }] as any[];

    const seen: any[] = [];
    const registry = new OpRegistry();
    registry.register('test.op', (action) => {
      seen.push(action);
    });

    executeTriggerScripts(
      triggers as any,
      events as any,
      registry,
      {
        scene: { id: 'scene-1', entities: {}, groups: {}, actions: {}, behaviors: {}, attachments: {}, conditions: {} } as any,
        targets: { entities: { e1: { id: 'e1', x: 0, y: 0, width: 1, height: 1 }, e2: { id: 'e2', x: 0, y: 0, width: 1, height: 1 } }, groups: {} } as any,
        options: { opRegistry: registry },
      } as any,
    );

    expect(seen).toHaveLength(1);
    expect(seen[0].target).toEqual({ type: 'entity', entityId: 'e2' });
  });
});

