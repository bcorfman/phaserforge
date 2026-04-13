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
  const existing = getAttachmentsForTarget(scene, target);
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
  return {
    attachmentId: id,
    scene: {
      ...scene,
      attachments: {
        ...scene.attachments,
        [id]: attachment,
      },
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

export function removeAttachment(scene: SceneSpec, id: Id): SceneSpec {
  if (!scene.attachments[id]) return scene;
  const { [id]: _removed, ...remaining } = scene.attachments;
  return { ...scene, attachments: remaining };
}

export function moveAttachmentWithinTarget(scene: SceneSpec, id: Id, direction: 'up' | 'down'): SceneSpec {
  const current = scene.attachments[id];
  if (!current) return scene;
  const list = getAttachmentsForTarget(scene, current.target);
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
