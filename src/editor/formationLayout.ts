import { arrangeGrid, type GridArrangeOptions } from '../model/formation';
import { makeGridLayout } from './groupCommands';
import { type EntitySpec, type Id, type SceneSpec } from '../model/types';

export interface GroupGridLayout {
  rows: number;
  cols: number;
  startX: number;
  startY: number;
  spacingX: number;
  spacingY: number;
}

export function inferGroupGridLayout(scene: SceneSpec, groupId: Id): GroupGridLayout | undefined {
  const group = scene.groups[groupId];
  if (!group) return undefined;
  if (group.layout?.type === 'grid') return group.layout;

  const members = group.members
    .map((memberId) => scene.entities[memberId])
    .filter((member): member is EntitySpec => Boolean(member));
  if (members.length === 0) return undefined;

  const uniqueX = [...new Set(members.map((member) => member.x))].sort((a, b) => a - b);
  const uniqueY = [...new Set(members.map((member) => member.y))].sort((a, b) => a - b);

  return {
    rows: uniqueY.length,
    cols: uniqueX.length,
    startX: uniqueX[0],
    startY: uniqueY[0],
    spacingX: uniqueX.length > 1 ? uniqueX[1] - uniqueX[0] : 0,
    spacingY: uniqueY.length > 1 ? uniqueY[1] - uniqueY[0] : 0,
  };
}

export function applyGroupGridLayout(
  scene: SceneSpec,
  groupId: Id,
  layout: GroupGridLayout
): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;
  const nextCount = layout.rows * layout.cols;
  if (nextCount < 1) return scene;

  const existingMembers = group.members
    .map((memberId) => scene.entities[memberId])
    .filter((member): member is EntitySpec => Boolean(member))
    .map((member) => ({ ...member }));
  if (existingMembers.length === 0) return scene;

  const template = existingMembers[0];
  const orderedMembers = existingMembers.slice(0, nextCount);
  const allocateId = createEntityIdAllocator(scene, group.members, group.id);

  for (let index = orderedMembers.length; index < nextCount; index += 1) {
    orderedMembers.push({
      id: allocateId(),
      width: template.width,
      height: template.height,
      x: template.x,
      y: template.y,
    });
  }

  arrangeGrid(orderedMembers, layout satisfies GridArrangeOptions<EntitySpec>);

  const nextEntities = { ...scene.entities };
  const removedMemberIds = group.members.slice(nextCount);
  for (const removedId of removedMemberIds) {
    delete nextEntities[removedId];
  }
  for (const member of orderedMembers) {
    nextEntities[member.id] = member;
  }

  return {
    ...scene,
    groups: {
      ...scene.groups,
      [groupId]: {
        ...group,
        members: orderedMembers.map((member) => member.id),
        layout: makeGridLayout(layout.rows, layout.cols, layout.startX, layout.startY, layout.spacingX, layout.spacingY),
      },
    },
    entities: nextEntities,
  };
}

function createEntityIdAllocator(scene: SceneSpec, memberIds: Id[], groupId: Id): () => Id {
  const numberedIds = memberIds
    .map(parseNumberedId)
    .filter((parsed): parsed is { prefix: string; value: number } => Boolean(parsed));

  if (numberedIds.length === memberIds.length && numberedIds.length > 0) {
    const prefix = numberedIds[0].prefix;
    const sharesPrefix = numberedIds.every((parsed) => parsed.prefix === prefix);
    if (sharesPrefix) {
      const usedNumbers = new Set(
        Object.keys(scene.entities)
          .map(parseNumberedId)
          .filter((parsed): parsed is { prefix: string; value: number } => Boolean(parsed) && parsed.prefix === prefix)
          .map((parsed) => parsed.value)
      );

      return () => {
        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) nextNumber += 1;
        usedNumbers.add(nextNumber);
        return `${prefix}${nextNumber}`;
      };
    }
  }

  const usedIds = new Set(Object.keys(scene.entities));
  return () => {
    let nextNumber = 1;
    let candidate = `${groupId}-member-${nextNumber}`;
    while (usedIds.has(candidate)) {
      nextNumber += 1;
      candidate = `${groupId}-member-${nextNumber}`;
    }
    usedIds.add(candidate);
    return candidate;
  };
}

function parseNumberedId(id: Id): { prefix: string; value: number } | undefined {
  const match = id.match(/^(.*?)(\d+)$/);
  if (!match) return undefined;

  return {
    prefix: match[1],
    value: Number(match[2]),
  };
}
