import { describe, expect, it } from 'vitest';
import type { AttachmentSpec, SceneSpec } from '../../src/model/types';
import { nestAttachmentsUnderRepeat } from '../../src/editor/attachmentCommands';

function makeScene(attachments: Record<string, AttachmentSpec>): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 800, height: 600 },
    entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
    groups: {},
    attachments,
    behaviors: {},
    actions: {},
    conditions: {},
    eventBlocks: {},
  };
}

describe('nestAttachmentsUnderRepeat', () => {
  it('moves siblings under Repeat, preserves relative order, clears tag, and updates children', () => {
    const scene = makeScene({
      rep: {
        id: 'rep',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'Repeat',
        enabled: true,
        order: 0,
        params: { count: 2 },
        children: [],
      } as any,
      a: {
        id: 'a',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'MoveXUntil',
        enabled: true,
        order: 1,
        tag: 'pg-1:1',
      } as any,
      b: {
        id: 'b',
        target: { type: 'entity', entityId: 'e1' },
        presetId: 'MoveYUntil',
        enabled: true,
        order: 2,
      } as any,
    });

    const next = nestAttachmentsUnderRepeat(scene, { repeatId: 'rep', attachmentIds: ['b', 'a'] });
    expect(next).not.toBe(scene);
    expect((next.attachments.rep as any).children).toEqual(['a', 'b']);
    expect(next.attachments.a.parentAttachmentId).toBe('rep');
    expect(next.attachments.b.parentAttachmentId).toBe('rep');
    expect((next.attachments.a as any).tag).toBeUndefined();
    expect(next.attachments.a.order).toBe(0);
    expect(next.attachments.b.order).toBe(1);
  });
});

