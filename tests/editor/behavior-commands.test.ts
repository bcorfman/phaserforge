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

  it('creates Bounce/Patrol attachments with default bounds sized to the target (not the world)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T00:00:00.000Z'));
    const { scene: nextBounce, attachmentId: bounceId } = createAttachment(sampleScene, { type: 'entity', entityId: 'e1' }, 'BouncePattern');
    const { scene: nextPatrol, attachmentId: patrolId } = createAttachment(sampleScene, { type: 'entity', entityId: 'e1' }, 'PatrolPattern');
    vi.useRealTimers();

    const e1 = sampleScene.entities.e1;
    const expected = { minX: e1.x - e1.width / 2, maxX: e1.x + e1.width / 2, minY: e1.y - e1.height / 2, maxY: e1.y + e1.height / 2 };

    for (const [scene, id] of [[nextBounce, bounceId], [nextPatrol, patrolId]] as const) {
      const att = scene.attachments[id];
      expect(att.target).toEqual({ type: 'entity', entityId: 'e1' });
      expect(att.condition?.type).toBe('BoundsHit');
      if (att.condition?.type === 'BoundsHit') {
        expect(att.condition.bounds).toEqual(expected);
        expect(att.condition.behavior).toBe('bounce');
      }
    }
  });

  it('creates OrbitPattern attachments with Home as the default center mode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T00:00:00.000Z'));
    const { scene: next, attachmentId } = createAttachment(sampleScene, { type: 'entity', entityId: 'e1' }, 'OrbitPattern');
    vi.useRealTimers();

    const att = next.attachments[attachmentId];
    expect(att.presetId).toBe('OrbitPattern');
    expect(att.params).toMatchObject({
      radius: 50,
      velocity: 100,
      clockwise: true,
      centerMode: 'home',
    });
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
