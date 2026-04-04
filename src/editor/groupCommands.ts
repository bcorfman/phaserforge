import { type ActionSpec, type GroupLayoutSpec, type GroupSpec, type Id, type SceneSpec, type TargetRef } from '../model/types';

export function updateGroupLayoutPosition(group: GroupSpec, dx: number, dy: number): GroupSpec {
  if (group.layout?.type !== 'grid') return group;
  return {
    ...group,
    layout: {
      ...group.layout,
      startX: group.layout.startX + dx,
      startY: group.layout.startY + dy,
    },
  };
}

export function removeEntityFromGroup(scene: SceneSpec, groupId: Id, entityId: Id): SceneSpec {
  const group = scene.groups[groupId];
  if (!group || !group.members.includes(entityId)) return scene;

  const remainingMembers = group.members.filter((memberId) => memberId !== entityId);
  if (remainingMembers.length === 0) {
    return removeGroupAndRetarget(scene, groupId, { type: 'entity', entityId });
  }

  return {
    ...scene,
    groups: {
      ...scene.groups,
      [groupId]: {
        ...group,
        members: remainingMembers,
        layout: { type: 'freeform' },
      },
    },
  };
}

export function dissolveGroup(scene: SceneSpec, groupId: Id): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;

  const fallbackEntityId = group.members[0];
  if (!fallbackEntityId) {
    return removeGroupAndRetarget(scene, groupId);
  }

  return removeGroupAndRetarget(scene, groupId, { type: 'entity', entityId: fallbackEntityId });
}

function removeGroupAndRetarget(scene: SceneSpec, groupId: Id, replacement?: TargetRef): SceneSpec {
  const { [groupId]: removedGroup, ...remainingGroups } = scene.groups;
  void removedGroup;

  return {
    ...scene,
    groups: remainingGroups,
    behaviors: Object.fromEntries(
      Object.entries(scene.behaviors).map(([id, behavior]) => [
        id,
        behavior.target.type === 'group' && behavior.target.groupId === groupId && replacement
          ? { ...behavior, target: replacement }
          : behavior,
      ])
    ),
    actions: Object.fromEntries(
      Object.entries(scene.actions).map(([id, action]) => [id, retargetAction(action, groupId, replacement)])
    ),
  };
}

function retargetAction(action: ActionSpec, groupId: Id, replacement?: TargetRef): ActionSpec {
  if (!replacement) return action;

  if (action.type === 'MoveUntil' && action.target.type === 'group' && action.target.groupId === groupId) {
    return { ...action, target: replacement };
  }

  if (action.type === 'Call' && action.target?.type === 'group' && action.target.groupId === groupId) {
    return { ...action, target: replacement };
  }

  return action;
}

export function makeGridLayout(rows: number, cols: number, startX: number, startY: number, spacingX: number, spacingY: number): GroupLayoutSpec {
  return { type: 'grid', rows, cols, startX, startY, spacingX, spacingY };
}
