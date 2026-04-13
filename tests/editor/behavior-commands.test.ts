import { describe, expect, it, vi } from 'vitest';
import {
  createAttachment,
  getTargetLabel,
  moveAttachmentWithinTarget,
  removeAttachment,
} from '../../src/editor/attachmentCommands';
import { sampleScene } from '../../src/model/sampleScene';

describe('attachment commands', () => {
  it('creates a MoveUntil attachment with a default BoundsHit condition spanning the world', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T00:00:00.000Z'));
    const { scene: next, attachmentId } = createAttachment(sampleScene, { type: 'group', groupId: 'g-enemies' }, 'MoveUntil');
    vi.useRealTimers();

    const att = next.attachments[attachmentId];
    expect(att.presetId).toBe('MoveUntil');
    expect(att.target).toEqual({ type: 'group', groupId: 'g-enemies' });
    expect(att.condition?.type).toBe('BoundsHit');
    if (att.condition?.type === 'BoundsHit') {
      expect(att.condition.bounds).toEqual({ minX: 0, minY: 0, maxX: 1024, maxY: 768 });
      expect(att.condition.scope).toBe('group-extents');
      expect(att.condition.behavior).toBe('limit');
    }
  });

  it('moves attachments up/down within their target list', () => {
    const movedUp = moveAttachmentWithinTarget(sampleScene, 'att-drop-right', 'up');
    const list = Object.values(movedUp.attachments)
      .filter((a) => a.target.type === 'group' && a.target.groupId === 'g-enemies')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(list[1].id).toBe('att-drop-right');
  });

  it('removes an attachment', () => {
    const next = removeAttachment(sampleScene, 'att-wait-right');
    expect(next.attachments['att-wait-right']).toBeUndefined();
  });

  it('labels targets using their name when available', () => {
    expect(getTargetLabel(sampleScene, { type: 'group', groupId: 'g-enemies' })).toBe('Enemy Formation');
  });
});
