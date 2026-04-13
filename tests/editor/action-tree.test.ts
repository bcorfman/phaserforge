import { describe, expect, it } from 'vitest';
import { getAttachmentsForTarget } from '../../src/editor/attachmentCommands';
import { sampleScene } from '../../src/model/sampleScene';

describe('attachmentCommands', () => {
  it('orders attachments for a target by order then id', () => {
    const list = getAttachmentsForTarget(sampleScene, { type: 'group', groupId: 'g-enemies' });

    expect(list.map((a) => a.id)).toEqual([
      'att-loop',
      'att-move-right',
      'att-drop-right',
      'att-wait-right',
      'att-move-left',
      'att-drop-left',
      'att-wait-left',
    ]);
  });

  it('returns an empty list when no attachments exist for a target', () => {
    const list = getAttachmentsForTarget(sampleScene, { type: 'entity', entityId: 'e1' });

    expect(list).toEqual([]);
  });
});
