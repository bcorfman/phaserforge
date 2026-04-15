import {
  arrangeArc,
  arrangeCircle,
  arrangeConcentricRings,
  arrangeCross,
  arrangeDiamond,
  arrangeGrid,
  arrangeHexagonalGrid,
  arrangeLine,
  arrangeTriangle,
  arrangeVFormation,
  type GridArrangeOptions,
} from '../model/formation';
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

export function applyGroupArrangeLayout(
  scene: SceneSpec,
  groupId: Id,
  arrangeKind: string,
  params: Record<string, number | string | boolean>
): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;
  const normalizedParams: Record<string, number | string | boolean> = { ...params };
  const roundParam = (key: string) => {
    if (!(key in normalizedParams)) return;
    const raw = normalizedParams[key];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed)) return;
    normalizedParams[key] = Math.round(parsed);
  };
  roundParam('centerX');
  roundParam('centerY');
  roundParam('startX');
  roundParam('startY');
  roundParam('apexX');
  roundParam('apexY');

  if (arrangeKind === 'grid') {
    const layout: GroupGridLayout = {
      rows: Math.max(1, Math.floor(Number(params.rows ?? 1))),
      cols: Math.max(1, Math.floor(Number(params.cols ?? 1))),
      startX: Math.round(Number(params.startX ?? 0)),
      startY: Math.round(Number(params.startY ?? 0)),
      spacingX: Math.round(Number(params.spacingX ?? 0)),
      spacingY: Math.round(Number(params.spacingY ?? 0)),
    };
    return applyGroupGridLayout(scene, groupId, layout);
  }

  const members = group.members
    .map((memberId) => scene.entities[memberId])
    .filter((member): member is EntitySpec => Boolean(member))
    .map((member) => ({ ...member }));
  if (members.length === 0) return scene;

  switch (arrangeKind) {
    case 'line':
      arrangeLine(members, { startX: Number(normalizedParams.startX ?? members[0].x), startY: Number(normalizedParams.startY ?? members[0].y), spacing: Number(params.spacing ?? 50) });
      break;
    case 'circle':
      arrangeCircle(members, { centerX: Number(normalizedParams.centerX ?? members[0].x), centerY: Number(normalizedParams.centerY ?? members[0].y), radius: Number(params.radius ?? 120) });
      break;
    case 'v_formation':
      arrangeVFormation(members, { apexX: Number(normalizedParams.apexX ?? members[0].x), apexY: Number(normalizedParams.apexY ?? members[0].y), spacing: Number(params.spacing ?? 60), direction: (params.direction === 'down' ? 'down' : 'up') });
      break;
    case 'diamond':
      arrangeDiamond(members, { centerX: Number(normalizedParams.centerX ?? members[0].x), centerY: Number(normalizedParams.centerY ?? members[0].y), spacing: Number(params.spacing ?? 60), includeCenter: params.includeCenter !== false });
      break;
    case 'triangle':
      arrangeTriangle(members, { apexX: Number(normalizedParams.apexX ?? members[0].x), apexY: Number(normalizedParams.apexY ?? members[0].y), rowSpacing: Number(params.rowSpacing ?? 60), lateralSpacing: Number(params.lateralSpacing ?? 60), invert: Boolean(params.invert) });
      break;
    case 'hexagonal_grid':
      arrangeHexagonalGrid(members, { rows: Math.max(1, Math.floor(Number(params.rows ?? 1))), cols: Math.max(1, Math.floor(Number(params.cols ?? 1))), startX: Number(normalizedParams.startX ?? members[0].x), startY: Number(normalizedParams.startY ?? members[0].y), spacing: Number(params.spacing ?? 60) });
      break;
    case 'arc':
      arrangeArc(members, { centerX: Number(normalizedParams.centerX ?? members[0].x), centerY: Number(normalizedParams.centerY ?? members[0].y), radius: Number(params.radius ?? 120), startAngleDeg: Number(params.startAngleDeg ?? 20), endAngleDeg: Number(params.endAngleDeg ?? 160) });
      break;
    case 'concentric_rings': {
      const ring1 = Number(params.ring1Radius ?? 80);
      const ring2 = Number(params.ring2Radius ?? 120);
      const count1 = Math.max(1, Math.floor(Number(params.ring1Count ?? Math.min(6, members.length))));
      const count2 = Math.max(0, Math.floor(Number(params.ring2Count ?? Math.max(0, members.length - count1))));
      arrangeConcentricRings(members, { centerX: Number(normalizedParams.centerX ?? members[0].x), centerY: Number(normalizedParams.centerY ?? members[0].y), radii: [ring1, ring2], spritesPerRing: [count1, count2] });
      break;
    }
    case 'cross':
      arrangeCross(members, { centerX: Number(normalizedParams.centerX ?? members[0].x), centerY: Number(normalizedParams.centerY ?? members[0].y), armLength: Number(params.armLength ?? 120), spacing: Number(params.spacing ?? 60), includeCenter: params.includeCenter !== false });
      break;
    default:
      return scene;
  }

  const nextEntities = { ...scene.entities };
  for (const member of members) {
    member.x = Math.round(member.x);
    member.y = Math.round(member.y);
    nextEntities[member.id] = member;
  }

  return {
    ...scene,
    entities: nextEntities,
    groups: {
      ...scene.groups,
      [groupId]: {
        ...group,
        layout: { type: 'arrange', arrangeKind, params: normalizedParams },
      },
    },
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
