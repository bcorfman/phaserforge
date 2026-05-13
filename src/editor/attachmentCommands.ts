import type { AttachmentSpec, Id, SceneSpec, TargetRef } from '../model/types';

export function getAttachmentsForTarget(scene: SceneSpec, target: TargetRef): AttachmentSpec[] {
  const list = Object.values(scene.attachments).filter((a) => targetsEqual(a.target, target));
  return list.sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function getAttachmentsForTargetAndEvent(scene: SceneSpec, target: TargetRef, eventId?: Id): AttachmentSpec[] {
  const list = Object.values(scene.attachments).filter((a) => {
    if (!targetsEqual(a.target, target)) return false;
    const aEventId = typeof a.eventId === 'string' && a.eventId.length > 0 ? a.eventId : undefined;
    const want = typeof eventId === 'string' && eventId.length > 0 ? eventId : undefined;
    return aEventId === want;
  });
  return list.sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export type AttachedActionRow =
  | { kind: 'attachment'; attachment: AttachmentSpec }
  | { kind: 'parallel-group'; groupId: string; attachments: AttachmentSpec[] };

const PARALLEL_GROUP_TAG_PREFIX = 'pargrp:';

function parseParallelGroupTag(tag: string | undefined): { groupId: string; slot: string } | null {
  if (!tag) return null;
  if (!tag.startsWith(PARALLEL_GROUP_TAG_PREFIX)) return null;
  const rest = tag.slice(PARALLEL_GROUP_TAG_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length < 2) return null;
  const groupId = parts[0];
  const slot = parts.slice(1).join(':');
  if (!groupId || !slot) return null;
  return { groupId, slot };
}

function buildParallelGroupTag(groupId: string, slot: string): string {
  return `${PARALLEL_GROUP_TAG_PREFIX}${groupId}:${slot}`;
}

export function buildAttachedActionRowsForTarget(scene: SceneSpec, target: TargetRef, parentAttachmentId?: Id): AttachedActionRow[] {
  const attachments = getAttachmentsForTarget(scene, target).filter((a) => (a.parentAttachmentId ?? undefined) === (parentAttachmentId ?? undefined));
  const byGroupId = new Map<string, AttachmentSpec[]>();
  const ungrouped: AttachmentSpec[] = [];

  for (const attachment of attachments) {
    const parsed = parseParallelGroupTag(attachment.tag);
    if (!parsed) {
      ungrouped.push(attachment);
      continue;
    }
    const list = byGroupId.get(parsed.groupId) ?? [];
    list.push(attachment);
    byGroupId.set(parsed.groupId, list);
  }

  const rows: Array<{ sortKey: { order: number; id: string }; row: AttachedActionRow }> = [];

  for (const attachment of ungrouped) {
    rows.push({
      sortKey: { order: attachment.order ?? 0, id: attachment.id },
      row: { kind: 'attachment', attachment },
    });
  }

  for (const [groupId, groupAttachments] of byGroupId.entries()) {
    if (groupAttachments.length < 2) {
      // If a "parallel group" only has one member, treat it like a normal attachment row.
      const only = groupAttachments[0];
      rows.push({
        sortKey: { order: only.order ?? 0, id: only.id },
        row: { kind: 'attachment', attachment: only },
      });
      continue;
    }
    const sorted = [...groupAttachments].sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
    const minOrder = Math.min(...sorted.map((a) => a.order ?? 0));
    const minId = sorted[0]?.id ?? groupId;
    rows.push({
      sortKey: { order: minOrder, id: minId },
      row: { kind: 'parallel-group', groupId, attachments: sorted },
    });
  }

  return rows
    .sort((a, b) => (a.sortKey.order !== b.sortKey.order ? a.sortKey.order - b.sortKey.order : a.sortKey.id.localeCompare(b.sortKey.id)))
    .map((r) => r.row);
}

export function buildAttachedActionRowsForTargetAndEvent(scene: SceneSpec, target: TargetRef, eventId?: Id, parentAttachmentId?: Id): AttachedActionRow[] {
  const attachments = getAttachmentsForTargetAndEvent(scene, target, eventId).filter(
    (a) => (a.parentAttachmentId ?? undefined) === (parentAttachmentId ?? undefined)
  );
  const byGroupId = new Map<string, AttachmentSpec[]>();
  const ungrouped: AttachmentSpec[] = [];

  for (const attachment of attachments) {
    const parsed = parseParallelGroupTag(attachment.tag);
    if (!parsed) {
      ungrouped.push(attachment);
      continue;
    }
    const list = byGroupId.get(parsed.groupId) ?? [];
    list.push(attachment);
    byGroupId.set(parsed.groupId, list);
  }

  const rows: Array<{ sortKey: { order: number; id: string }; row: AttachedActionRow }> = [];

  for (const attachment of ungrouped) {
    rows.push({
      sortKey: { order: attachment.order ?? 0, id: attachment.id },
      row: { kind: 'attachment', attachment },
    });
  }

  for (const [groupId, groupAttachments] of byGroupId.entries()) {
    if (groupAttachments.length < 2) {
      const only = groupAttachments[0];
      rows.push({
        sortKey: { order: only.order ?? 0, id: only.id },
        row: { kind: 'attachment', attachment: only },
      });
      continue;
    }
    const sorted = [...groupAttachments].sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
    const minOrder = Math.min(...sorted.map((a) => a.order ?? 0));
    const minId = sorted[0]?.id ?? groupId;
    rows.push({
      sortKey: { order: minOrder, id: minId },
      row: { kind: 'parallel-group', groupId, attachments: sorted },
    });
  }

  return rows
    .sort((a, b) => (a.sortKey.order !== b.sortKey.order ? a.sortKey.order - b.sortKey.order : a.sortKey.id.localeCompare(b.sortKey.id)))
    .map((r) => r.row);
}

export function getAttachmentById(scene: SceneSpec, id: Id): AttachmentSpec | undefined {
  return scene.attachments[id];
}

export function createAttachment(
  scene: SceneSpec,
  target: TargetRef,
  presetId: string,
  init: Partial<AttachmentSpec> = {}
): { scene: SceneSpec; attachmentId: Id } {
  const id: Id = `att-${Date.now()}`;
  const existing = getAttachmentsForTargetAndEvent(scene, target, init.eventId).filter(
    (a) => (a.parentAttachmentId ?? undefined) === (init.parentAttachmentId ?? undefined)
  );
  const order = init.order ?? (existing.length === 0 ? 0 : (existing[existing.length - 1].order ?? existing.length - 1) + 1);

  const world = scene.world ?? { width: 1024, height: 768 };
  const defaultApplyTo = target.type === 'group' ? 'group' : undefined;
  const baseDefaults: Partial<AttachmentSpec> = { applyTo: defaultApplyTo };

  if (presetId === 'MoveUntil') {
    baseDefaults.params = { velocityX: 0, velocityY: 0 };
    baseDefaults.condition = {
      type: 'BoundsHit',
      bounds: { minX: 0, minY: 0, maxX: world.width, maxY: world.height },
      mode: 'any',
      scope: target.type === 'group' ? 'group-extents' : 'member-any',
      behavior: 'limit',
    };
  } else if (presetId === 'Wait') {
    baseDefaults.params = { durationMs: 100 };
  } else if (presetId === 'Call') {
    baseDefaults.params = { callId: 'callback' };
  } else if (presetId === 'EmitEvent') {
    baseDefaults.params = { eventName: 'Event.Name' };
  } else if (presetId === 'Repeat') {
    baseDefaults.params = {};
  }

  const attachment: AttachmentSpec = {
    id,
    target,
    presetId,
    enabled: true,
    order,
    ...baseDefaults,
    ...init,
  };
  const nextAttachments: Record<Id, AttachmentSpec> = {
    ...scene.attachments,
    [id]: attachment,
  };

  if (attachment.parentAttachmentId) {
    const parent = nextAttachments[attachment.parentAttachmentId];
    if (parent && parent.presetId === 'Repeat') {
      const children = Array.isArray((parent as any).children) ? (parent as any).children : [];
      if (!children.includes(id)) {
        nextAttachments[parent.id] = { ...(parent as any), children: [...children, id] };
      }
    }
  }
  return {
    attachmentId: id,
    scene: {
      ...scene,
      attachments: nextAttachments,
    },
  };
}

export function updateAttachment(scene: SceneSpec, id: Id, next: AttachmentSpec): SceneSpec {
  if (!scene.attachments[id]) return scene;
  return {
    ...scene,
    attachments: {
      ...scene.attachments,
      [id]: next,
    },
  };
}

export function makeAttachmentsParallel(
  scene: SceneSpec,
  target: TargetRef,
  attachmentIds: Id[],
  opts: { groupId?: string } = {}
): { scene: SceneSpec; groupId: string } {
  const uniqueIds = Array.from(new Set(attachmentIds)).filter(Boolean);
  if (uniqueIds.length < 2) return { scene, groupId: opts.groupId ?? 'pg-empty' };

  const attachments = uniqueIds.map((id) => scene.attachments[id]).filter(Boolean) as AttachmentSpec[];
  if (attachments.length < 2) return { scene, groupId: opts.groupId ?? 'pg-empty' };
  if (!attachments.every((a) => targetsEqual(a.target, target))) return { scene, groupId: opts.groupId ?? 'pg-empty' };
  const eventId = typeof attachments[0]?.eventId === 'string' ? attachments[0].eventId : undefined;
  if (!attachments.every((a) => (typeof a.eventId === 'string' ? a.eventId : undefined) === eventId)) return { scene, groupId: opts.groupId ?? 'pg-empty' };
  const parentAttachmentId = attachments[0]?.parentAttachmentId;
  if (!attachments.every((a) => (a.parentAttachmentId ?? undefined) === (parentAttachmentId ?? undefined))) return { scene, groupId: opts.groupId ?? 'pg-empty' };

  const groupId = opts.groupId ?? `pg-${Date.now()}`;
  const minOrder = Math.min(...attachments.map((a) => a.order ?? 0));
  const sorted = [...attachments].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });

  const nextAttachments: Record<Id, AttachmentSpec> = { ...scene.attachments };
  for (let index = 0; index < sorted.length; index += 1) {
    const attachment = sorted[index];
    const slot = String(index + 1);
    const tag = buildParallelGroupTag(groupId, slot);
    nextAttachments[attachment.id] = {
      ...attachment,
      tag,
      order: minOrder + index,
    };
  }

  return { groupId, scene: { ...scene, attachments: nextAttachments } };
}

export function ungroupParallelAttachments(scene: SceneSpec, target: TargetRef, groupId: string, eventId?: Id): SceneSpec {
  if (!groupId) return scene;
  const parentAttachmentId = Object.values(scene.attachments).find((a) => {
    if (!targetsEqual(a.target, target)) return false;
    const aEventId = typeof a.eventId === 'string' && a.eventId.length > 0 ? a.eventId : undefined;
    const want = typeof eventId === 'string' && eventId.length > 0 ? eventId : undefined;
    if (aEventId !== want) return false;
    const parsed = parseParallelGroupTag(a.tag);
    return parsed?.groupId === groupId;
  })?.parentAttachmentId;
  const nextAttachments: Record<Id, AttachmentSpec> = { ...scene.attachments };
  let changed = false;
  for (const attachment of Object.values(scene.attachments)) {
    if (!targetsEqual(attachment.target, target)) continue;
    const aEventId = typeof attachment.eventId === 'string' && attachment.eventId.length > 0 ? attachment.eventId : undefined;
    const want = typeof eventId === 'string' && eventId.length > 0 ? eventId : undefined;
    if (aEventId !== want) continue;
    if ((attachment.parentAttachmentId ?? undefined) !== (parentAttachmentId ?? undefined)) continue;
    const parsed = parseParallelGroupTag(attachment.tag);
    if (!parsed || parsed.groupId !== groupId) continue;
    const { tag: _tag, ...rest } = attachment as any;
    nextAttachments[attachment.id] = { ...rest };
    changed = true;
  }
  return changed ? { ...scene, attachments: nextAttachments } : scene;
}

export function removeAttachment(scene: SceneSpec, id: Id): SceneSpec {
  const removed = scene.attachments[id];
  if (!removed) return scene;

  const toRemove = new Set<string>();
  const visit = (attachmentId: string): void => {
    if (toRemove.has(attachmentId)) return;
    const a = scene.attachments[attachmentId];
    if (!a) return;
    toRemove.add(attachmentId);
    if (Array.isArray((a as any).children)) {
      for (const childId of (a as any).children) visit(String(childId));
    }
  };
  visit(id);

  const remaining: Record<Id, AttachmentSpec> = { ...scene.attachments };
  for (const removeId of toRemove) delete remaining[removeId];

  for (const attachment of Object.values(remaining)) {
    if (!Array.isArray((attachment as any).children)) continue;
    const nextChildren = (attachment as any).children.filter((childId: string) => !toRemove.has(String(childId)));
    if (nextChildren.length === (attachment as any).children.length) continue;
    remaining[attachment.id] = { ...(attachment as any), children: nextChildren };
  }

  return { ...scene, attachments: remaining };
}

export function moveAttachmentWithinTarget(scene: SceneSpec, id: Id, direction: 'up' | 'down'): SceneSpec {
  const current = scene.attachments[id];
  if (!current) return scene;
  const list = getAttachmentsForTargetAndEvent(scene, current.target, current.eventId).filter(
    (a) => (a.parentAttachmentId ?? undefined) === (current.parentAttachmentId ?? undefined)
  );
  const index = list.findIndex((a) => a.id === id);
  if (index < 0) return scene;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= list.length) return scene;
  const a = list[index];
  const b = list[swapIndex];
  const aOrder = a.order ?? index;
  const bOrder = b.order ?? swapIndex;
  return {
    ...scene,
    attachments: {
      ...scene.attachments,
      [a.id]: { ...a, order: bOrder },
      [b.id]: { ...b, order: aOrder },
    },
  };
}

export function moveParallelGroupWithinTarget(scene: SceneSpec, target: TargetRef, groupId: string, direction: 'up' | 'down', eventId?: Id): SceneSpec {
  const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventId);
  const index = rows.findIndex((r) => r.kind === 'parallel-group' && r.groupId === groupId);
  if (index < 0) return scene;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return scene;

  const rowA = rows[index];
  const rowB = rows[swapIndex];
  if (rowA.kind !== 'parallel-group') return scene;

  const aAttachments = rowA.attachments;
  const bAttachments = rowB.kind === 'parallel-group' ? rowB.attachments : [rowB.attachment];

  const aOrders = aAttachments.map((a) => a.order ?? 0);
  const bOrders = bAttachments.map((a) => a.order ?? 0);
  const aMin = Math.min(...aOrders);
  const bMin = Math.min(...bOrders);

  // Swap blocks by shifting each set so their mins swap.
  const aDelta = bMin - aMin;
  const bDelta = aMin - bMin;

  const nextAttachments: Record<Id, AttachmentSpec> = { ...scene.attachments };
  for (const attachment of aAttachments) {
    nextAttachments[attachment.id] = { ...attachment, order: (attachment.order ?? 0) + aDelta };
  }
  for (const attachment of bAttachments) {
    nextAttachments[attachment.id] = { ...attachment, order: (attachment.order ?? 0) + bDelta };
  }

  return { ...scene, attachments: nextAttachments };
}

export function getTargetLabel(scene: SceneSpec, target: TargetRef): string {
  if (target.type === 'entity') {
    return scene.entities[target.entityId]?.name ?? target.entityId;
  }
  return scene.groups[target.groupId]?.name ?? target.groupId;
}

function targetsEqual(a: TargetRef, b: TargetRef): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'entity') return a.entityId === (b as any).entityId;
  return a.groupId === (b as any).groupId;
}
