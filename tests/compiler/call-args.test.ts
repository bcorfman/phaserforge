import { describe, expect, it, vi } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function attachmentScene(params: Record<string, any>): SceneSpec {
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
        params,
      },
    },
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('compileAttachments Call args', () => {
  it('passes through shallow primitive args (string/boolean/null/number)', () => {
    const scene = attachmentScene({
      callId: 'onCall',
      foo: 'bar',
      flag: true,
      count: 3,
      z: null,
    });

    let received: any = undefined;
    const compiled = compileScene(scene, {
      callRegistry: {
        onCall: (action) => {
          received = action.args;
        },
      },
    });

    compiled.startAll();
    expect(received).toEqual({
      foo: 'bar',
      flag: true,
      count: 3,
      z: null,
    });
  });

  it('does not throw for unknown callId and warns once when run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = attachmentScene({ callId: 'missing-handler', dx: 1, dy: 2 });

    expect(() => compileScene(scene, { callRegistry: {} })).not.toThrow();
    const compiled = compileScene(scene, { callRegistry: {} });
    compiled.startAll();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

