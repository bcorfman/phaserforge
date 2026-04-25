import { describe, expect, it, vi } from 'vitest';
import { OpRegistry } from '../../src/compiler/opRegistry';
import type { CallActionSpec, SceneSpec } from '../../src/model/types';
import { compileScene } from '../../src/compiler/compileScene';

function attachmentScene(callId: string, params: Record<string, any> = {}): SceneSpec {
  return {
    id: 'scene-1',
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 },
    },
    groups: {},
    attachments: {
      att1: {
        id: 'att1',
        target: { type: 'entity', entityId: 'e1' },
        enabled: true,
        order: 0,
        presetId: 'Call',
        params: { callId, ...params },
      },
    },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('OpRegistry', () => {
  it('invokes registered handlers', () => {
    const opRegistry = new OpRegistry();
    const called: CallActionSpec[] = [];
    opRegistry.register('onCall', (action) => called.push(action));

    const compiled = compileScene(attachmentScene('onCall', { foo: 'bar' }), { opRegistry });
    compiled.startAll();
    expect(called).toHaveLength(1);
    expect(called[0].callId).toBe('onCall');
    expect(called[0].args).toEqual({ foo: 'bar' });
  });

  it('warns (and does not throw) on missing op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const opRegistry = new OpRegistry();

    expect(() => compileScene(attachmentScene('missing'), { opRegistry })).not.toThrow();
    const compiled = compileScene(attachmentScene('missing'), { opRegistry });
    compiled.startAll();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

