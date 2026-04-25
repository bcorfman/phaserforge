import { type GroupLayoutSpec, type GroupSpec, type Id, type SceneSpec, type TargetRef } from '../model/types';

export function updateGroupLayoutPosition(group: GroupSpec, dx: number, dy: number): GroupSpec {
  if (group.layout?.type === 'grid') {
    return {
      ...group,
      layout: {
        ...group.layout,
        startX: group.layout.startX + dx,
        startY: group.layout.startY + dy,
      },
    };
  }

  if (group.layout?.type === 'arrange') {
    const params = group.layout.params ?? {};
    const nextParams: Record<string, number | string | boolean> = { ...params };

    const shift = (key: string, delta: number) => {
      if (!(key in nextParams)) return;
      const raw = nextParams[key];
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(parsed)) return;
      nextParams[key] = Math.round(parsed + delta);
    };

    shift('centerX', dx);
    shift('centerY', dy);
    shift('startX', dx);
    shift('startY', dy);
    shift('apexX', dx);
    shift('apexY', dy);

    return {
      ...group,
      layout: {
        ...group.layout,
        params: nextParams,
      },
    };
  }

  return group;
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

export function addEntitiesToGroup(scene: SceneSpec, groupId: Id, entityIds: Id[]): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;
  if (entityIds.length === 0) return scene;

  const toAdd = entityIds.filter((id) => Boolean(scene.entities[id]));
  if (toAdd.length === 0) return scene;

  let nextScene = scene;

  for (const entityId of toAdd) {
    for (const [otherGroupId, otherGroup] of Object.entries(nextScene.groups)) {
      if (otherGroupId === groupId) continue;
      if (!otherGroup.members.includes(entityId)) continue;
      nextScene = removeEntityFromGroup(nextScene, otherGroupId, entityId);
      break;
    }
  }

  const refreshedGroup = nextScene.groups[groupId];
  if (!refreshedGroup) return nextScene;

  const memberSet = new Set(refreshedGroup.members);
  const mergedMembers = [...refreshedGroup.members];
  for (const entityId of toAdd) {
    if (memberSet.has(entityId)) continue;
    memberSet.add(entityId);
    mergedMembers.push(entityId);
  }

  if (mergedMembers.length === refreshedGroup.members.length) return nextScene;

  return {
    ...nextScene,
    groups: {
      ...nextScene.groups,
      [groupId]: {
        ...refreshedGroup,
        members: mergedMembers,
        layout: { type: 'freeform' },
      },
    },
  };
}

export function insertEntitiesIntoGroup(scene: SceneSpec, groupId: Id, entityIds: Id[], index: number): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;
  if (entityIds.length === 0) return scene;

  const toInsert: Id[] = [];
  const seen = new Set<Id>();
  for (const id of entityIds) {
    if (!scene.entities[id]) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    toInsert.push(id);
  }
  if (toInsert.length === 0) return scene;

  let nextScene = scene;

  // Remove from other groups first.
  for (const entityId of toInsert) {
    for (const [otherGroupId, otherGroup] of Object.entries(nextScene.groups)) {
      if (!otherGroup.members.includes(entityId)) continue;
      if (otherGroupId === groupId) continue;
      nextScene = removeEntityFromGroup(nextScene, otherGroupId, entityId);
      break;
    }
  }

  const refreshedGroup = nextScene.groups[groupId];
  if (!refreshedGroup) return nextScene;

  // Reorder within same group by first removing any existing occurrences.
  const remainingMembers = refreshedGroup.members.filter((memberId) => !seen.has(memberId));

  const clampedIndex = Math.max(0, Math.min(Math.floor(index), remainingMembers.length));
  const nextMembers = [
    ...remainingMembers.slice(0, clampedIndex),
    ...toInsert,
    ...remainingMembers.slice(clampedIndex),
  ];

  if (nextMembers.length === refreshedGroup.members.length && nextMembers.every((id, i) => id === refreshedGroup.members[i])) {
    return nextScene;
  }

  return {
    ...nextScene,
    groups: {
      ...nextScene.groups,
      [groupId]: {
        ...refreshedGroup,
        members: nextMembers,
        layout: { type: 'freeform' },
      },
    },
  };
}

export function removeEntitiesFromGroups(scene: SceneSpec, entityIds: Id[]): SceneSpec {
  if (entityIds.length === 0) return scene;
  let nextScene = scene;

  for (const entityId of entityIds) {
    if (!nextScene.entities[entityId]) continue;
    const groupId = Object.keys(nextScene.groups).find((id) => nextScene.groups[id]?.members.includes(entityId));
    if (!groupId) continue;
    nextScene = removeEntityFromGroup(nextScene, groupId, entityId);
  }

  return nextScene;
}

function removeGroupAndRetarget(scene: SceneSpec, groupId: Id, replacement?: TargetRef): SceneSpec {
  const { [groupId]: removedGroup, ...remainingGroups } = scene.groups;
  void removedGroup;

  return {
    ...scene,
    groups: remainingGroups,
    attachments: Object.fromEntries(
      Object.entries(scene.attachments).flatMap(([id, attachment]) => {
        if (attachment.target.type !== 'group' || attachment.target.groupId !== groupId) return [[id, attachment]];
        if (!replacement) return [];
        return [[id, { ...attachment, target: replacement, applyTo: undefined }]];
      })
    ),
  };
}

export function makeGridLayout(rows: number, cols: number, startX: number, startY: number, spacingX: number, spacingY: number): GroupLayoutSpec {
  return { type: 'grid', rows, cols, startX, startY, spacingX, spacingY };
}
