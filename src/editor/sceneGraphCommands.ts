import type { Id, SceneSpec, TargetRef } from '../model/types';
import { removeEntityFromGroup, dissolveGroup as dissolveGroupOnly } from './groupCommands';

function targetsEqual(a: TargetRef, b: TargetRef): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'entity') return a.entityId === (b as any).entityId;
  return a.groupId === (b as any).groupId;
}

export function removeAttachmentFromScene(scene: SceneSpec, attachmentId: Id): SceneSpec {
  if (!scene.attachments[attachmentId]) return scene;
  const { [attachmentId]: _removed, ...remaining } = scene.attachments;
  return { ...scene, attachments: remaining };
}

export function removeEntityFromScene(scene: SceneSpec, entityId: Id): SceneSpec {
  if (!scene.entities[entityId]) return scene;

  // Remove entity-targeted attachments.
  const attachments = Object.fromEntries(
    Object.entries(scene.attachments).filter(([_id, attachment]) => !(attachment.target.type === 'entity' && attachment.target.entityId === entityId))
  );

  // Remove from groups (and freeform the group layout when membership changes).
  let nextScene: SceneSpec = { ...scene, attachments };
  for (const group of Object.values(nextScene.groups)) {
    if (!group.members.includes(entityId)) continue;
    nextScene = removeEntityFromGroup(nextScene, group.id, entityId);
  }

  const { [entityId]: _removedEntity, ...remainingEntities } = nextScene.entities;
  return { ...nextScene, entities: remainingEntities };
}

export function removeGroupFromScene(scene: SceneSpec, groupId: Id): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;

  // Remove group-targeted attachments.
  const attachments = Object.fromEntries(
    Object.entries(scene.attachments).filter(([_id, attachment]) => !(attachment.target.type === 'group' && attachment.target.groupId === groupId))
  );
  const nextScene: SceneSpec = { ...scene, attachments };
  const { [groupId]: _removedGroup, ...remainingGroups } = nextScene.groups;
  return { ...nextScene, groups: remainingGroups };
}

export function dissolveGroup(scene: SceneSpec, groupId: Id): SceneSpec {
  return dissolveGroupOnly(scene, groupId);
}

export function removeSceneGraphItem(
  scene: SceneSpec,
  item: { kind: 'entity' | 'group' | 'attachment'; id: Id }
): SceneSpec {
  switch (item.kind) {
    case 'entity':
      return removeEntityFromScene(scene, item.id);
    case 'group':
      return removeGroupFromScene(scene, item.id);
    case 'attachment':
      return removeAttachmentFromScene(scene, item.id);
    default:
      return scene;
  }
}

export function countAttachmentsForTarget(scene: SceneSpec, target: TargetRef): number {
  return Object.values(scene.attachments).filter((a) => targetsEqual(a.target, target)).length;
}
