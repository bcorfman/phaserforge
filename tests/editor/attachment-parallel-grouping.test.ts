import { describe, expect, it } from 'vitest';
import type { SceneSpec } from '../../src/model/types';
import {
  buildAttachedActionRowsForTarget,
  makeAttachmentsParallel,
  ungroupParallelAttachments,
} from '../../src/editor/attachmentCommands';

function sceneWithEntityAttachments(): SceneSpec {
  return {
    id: 'scene',
    world: { width: 1024, height: 768 },
    entities: {
      e1: { id: 'e1', name: 'Ship', x: 0, y: 0 },
    } as any,
    groups: {},
    behaviors: {},
    actions: {},
    conditions: {},
    attachments: {
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, presetId: 'BlinkUntil', enabled: true, order: 0 },
      a2: { id: 'a2', target: { type: 'entity', entityId: 'e1' }, presetId: 'MoveUntil', enabled: true, order: 1 },
      a3: { id: 'a3', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', enabled: true, order: 2 },
    } as any,
  } as SceneSpec;
}

describe('attachment parallel grouping helpers', () => {
  it('groups selected attachments into a parallel group row', () => {
    const scene = sceneWithEntityAttachments();
    const { scene: next, groupId } = makeAttachmentsParallel(
      scene,
      { type: 'entity', entityId: 'e1' },
      ['a1', 'a2'],
      { groupId: 'pg-test' }
    );

    expect(groupId).toBe('pg-test');
    expect(next.attachments.a1.tag).toMatch(/^pargrp:pg-test:/);
    expect(next.attachments.a2.tag).toMatch(/^pargrp:pg-test:/);
    expect(next.attachments.a1.tag).not.toBe(next.attachments.a2.tag);

    const rows = buildAttachedActionRowsForTarget(next, { type: 'entity', entityId: 'e1' });
    expect(rows.map((r) => r.kind)).toEqual(['parallel-group', 'attachment']);
    const group = rows[0];
    if (group.kind !== 'parallel-group') throw new Error('expected parallel-group');
    expect(group.groupId).toBe('pg-test');
    expect(group.attachments.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('ungroups a parallel group back into individual steps', () => {
    const scene = sceneWithEntityAttachments();
    const { scene: grouped } = makeAttachmentsParallel(
      scene,
      { type: 'entity', entityId: 'e1' },
      ['a1', 'a2'],
      { groupId: 'pg-test' }
    );

    const ungrouped = ungroupParallelAttachments(grouped, { type: 'entity', entityId: 'e1' }, 'pg-test');
    expect(ungrouped.attachments.a1.tag).toBeUndefined();
    expect(ungrouped.attachments.a2.tag).toBeUndefined();

    const rows = buildAttachedActionRowsForTarget(ungrouped, { type: 'entity', entityId: 'e1' });
    expect(rows.map((r) => r.kind)).toEqual(['attachment', 'attachment', 'attachment']);
  });
});

