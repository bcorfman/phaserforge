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
      nextParams[key] = parsed + delta;
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
