import { EntitySpec, GroupSpec, SceneSpec } from '../model/types';

export interface GroupSummary {
  group: GroupSpec;
  members: EntitySpec[];
}

export interface GridLayoutSummary {
  kind: 'grid' | 'freeform';
  rows?: number;
  cols?: number;
  spacingX?: number;
  spacingY?: number;
}

export function summarizeSceneGroups(scene: SceneSpec): {
  groups: GroupSummary[];
  ungroupedEntities: EntitySpec[];
} {
  const groupedEntityIds = new Set<string>();
  const groups = Object.values(scene.groups).map((group) => {
    const members = group.members
      .map((memberId) => scene.entities[memberId])
      .filter((member): member is EntitySpec => Boolean(member));

    members.forEach((member) => groupedEntityIds.add(member.id));

    return { group, members };
  });

  const ungroupedEntities = Object.values(scene.entities).filter((entity) => !groupedEntityIds.has(entity.id));

  return { groups, ungroupedEntities };
}

export function summarizeGridLayout(members: EntitySpec[]): GridLayoutSummary {
  if (members.length === 0) return { kind: 'freeform' };

  const uniqueX = [...new Set(members.map((member) => member.x))].sort((a, b) => a - b);
  const uniqueY = [...new Set(members.map((member) => member.y))].sort((a, b) => a - b);

  if (uniqueX.length * uniqueY.length !== members.length) {
    return { kind: 'freeform' };
  }

  const positions = new Set(members.map((member) => `${member.x}:${member.y}`));
  for (const y of uniqueY) {
    for (const x of uniqueX) {
      if (!positions.has(`${x}:${y}`)) {
        return { kind: 'freeform' };
      }
    }
  }

  return {
    kind: 'grid',
    rows: uniqueY.length,
    cols: uniqueX.length,
    spacingX: uniqueX.length > 1 ? uniqueX[1] - uniqueX[0] : 0,
    spacingY: uniqueY.length > 1 ? uniqueY[1] - uniqueY[0] : 0,
  };
}
