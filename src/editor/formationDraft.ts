import type { ProjectSpec } from '../model/types';
import type { EntitySpec, Id, SceneSpec } from '../model/types';
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
} from '../model/formation';
import { getSceneWorld } from './sceneWorld';

export type FormationTemplateSource =
  | { kind: 'entity'; entityId: Id }
  | { kind: 'asset'; assetKind: 'image' | 'spritesheet'; assetId: Id };

export type FormationDraftSpec = {
  template: FormationTemplateSource;
  name: string;
  arrangeKind: string;
  params: Record<string, number | string | boolean>;
  memberCount: number;
};

export function getTemplateDisplayLabel(scene: SceneSpec, project: ProjectSpec, template: FormationTemplateSource): string {
  if (template.kind === 'entity') {
    const entity = scene.entities[template.entityId];
    return entity ? `Sprite: ${entity.name ?? entity.id}` : `Sprite: ${template.entityId}`;
  }
  const asset =
    template.assetKind === 'image'
      ? project.assets.images?.[template.assetId]
      : project.assets.spriteSheets?.[template.assetId];
  const label = asset?.name ?? template.assetId;
  return `Asset: ${label}`;
}

export function getTemplateSize(scene: SceneSpec, project: ProjectSpec, template: FormationTemplateSource): { width: number; height: number } {
  const fallback = 64;
  if (template.kind === 'entity') {
    const entity = scene.entities[template.entityId];
    return { width: entity?.width ?? fallback, height: entity?.height ?? fallback };
  }
  if (template.assetKind === 'image') {
    const image = project.assets.images?.[template.assetId];
    return { width: image?.width ?? fallback, height: image?.height ?? fallback };
  }
  const sheet = project.assets.spriteSheets?.[template.assetId];
  return { width: sheet?.grid?.frameWidth ?? fallback, height: sheet?.grid?.frameHeight ?? fallback };
}

export function buildDefaultDraftParams(arrangeKind: string, scene: SceneSpec): Record<string, number | string | boolean> {
  const world = getSceneWorld(scene);
  const centerX = Math.round(world.width / 2);
  const centerY = Math.round(world.height / 2);

  if (arrangeKind === 'grid') {
    return { rows: 3, cols: 4, spacing: 24, centerX, centerY };
  }
  if (arrangeKind === 'line') return { startX: centerX, startY: centerY, spacing: 50 };
  if (arrangeKind === 'circle') return { centerX, centerY, radius: 120 };
  if (arrangeKind === 'v_formation') return { apexX: centerX, apexY: centerY, spacing: 60, direction: 'up' };
  if (arrangeKind === 'diamond') return { centerX, centerY, spacing: 60, includeCenter: true };
  if (arrangeKind === 'triangle') return { apexX: centerX, apexY: centerY, rowSpacing: 60, lateralSpacing: 60, invert: false };
  if (arrangeKind === 'hexagonal_grid') return { rows: 3, cols: 4, startX: centerX, startY: centerY, spacing: 60 };
  if (arrangeKind === 'arc') return { centerX, centerY, radius: 120, startAngleDeg: 20, endAngleDeg: 160 };
  if (arrangeKind === 'concentric_rings') return { centerX, centerY, ring1Radius: 80, ring2Radius: 120, ring1Count: 6, ring2Count: 6 };
  if (arrangeKind === 'cross') return { centerX, centerY, armLength: 120, spacing: 60, includeCenter: true };
  return { centerX, centerY };
}

export function computeFormationDraftPositions(
  draft: Pick<FormationDraftSpec, 'arrangeKind' | 'params' | 'memberCount'>,
  templateSize: { width: number; height: number }
): Array<{ x: number; y: number; width: number; height: number }> {
  const width = Math.max(1, Math.round(Number(templateSize.width ?? 64) || 64));
  const height = Math.max(1, Math.round(Number(templateSize.height ?? 64) || 64));

  const createMembers = (count: number, seedX: number, seedY: number): EntitySpec[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `draft-${index}`,
      x: seedX,
      y: seedY,
      width,
      height,
    }));

  const p = draft.params ?? {};
  const num = (key: string, fallback: number) => {
    const raw = (p as any)[key];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const memberCount = Math.max(1, Math.min(200, Math.floor(Number(draft.memberCount ?? 1) || 1)));
  const centerX = Math.round(num('centerX', 0));
  const centerY = Math.round(num('centerY', 0));

  if (draft.arrangeKind === 'grid') {
    const rows = Math.max(1, Math.floor(num('rows', 1)));
    const cols = Math.max(1, Math.floor(num('cols', 1)));
    const count = rows * cols;
    const spacing = Math.round(num('spacing', 24));
    const startX = centerX - ((cols - 1) * spacing) / 2;
    const startY = centerY - ((rows - 1) * spacing) / 2;
    const members = createMembers(count, centerX, centerY);
    arrangeGrid(members, { rows, cols, startX, startY, spacingX: spacing, spacingY: spacing });
    return members.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), width, height }));
  }

  const seedX = Math.round(num('startX', centerX));
  const seedY = Math.round(num('startY', centerY));
  const members = createMembers(memberCount, seedX, seedY);

  switch (draft.arrangeKind) {
    case 'line':
      arrangeLine(members, { startX: num('startX', seedX), startY: num('startY', seedY), spacing: num('spacing', 50) });
      break;
    case 'circle':
      arrangeCircle(members, { centerX: num('centerX', seedX), centerY: num('centerY', seedY), radius: num('radius', 120) });
      break;
    case 'v_formation':
      arrangeVFormation(members, { apexX: num('apexX', seedX), apexY: num('apexY', seedY), spacing: num('spacing', 60), direction: (p as any).direction === 'down' ? 'down' : 'up' });
      break;
    case 'diamond':
      arrangeDiamond(members, { centerX: num('centerX', seedX), centerY: num('centerY', seedY), spacing: num('spacing', 60), includeCenter: (p as any).includeCenter !== false });
      break;
    case 'triangle':
      arrangeTriangle(members, { apexX: num('apexX', seedX), apexY: num('apexY', seedY), rowSpacing: num('rowSpacing', 60), lateralSpacing: num('lateralSpacing', 60), invert: Boolean((p as any).invert) });
      break;
    case 'hexagonal_grid':
      arrangeHexagonalGrid(members, { rows: Math.max(1, Math.floor(num('rows', 1))), cols: Math.max(1, Math.floor(num('cols', 1))), startX: num('startX', seedX), startY: num('startY', seedY), spacing: num('spacing', 60) });
      break;
    case 'arc':
      arrangeArc(members, { centerX: num('centerX', seedX), centerY: num('centerY', seedY), radius: num('radius', 120), startAngleDeg: num('startAngleDeg', 20), endAngleDeg: num('endAngleDeg', 160) });
      break;
    case 'concentric_rings': {
      const ring1 = num('ring1Radius', 80);
      const ring2 = num('ring2Radius', 120);
      const count1 = Math.max(1, Math.floor(num('ring1Count', Math.min(6, members.length))));
      const count2 = Math.max(0, Math.floor(num('ring2Count', Math.max(0, members.length - count1))));
      arrangeConcentricRings(members, { centerX: num('centerX', seedX), centerY: num('centerY', seedY), radii: [ring1, ring2], spritesPerRing: [count1, count2] });
      break;
    }
    case 'cross':
      arrangeCross(members, { centerX: num('centerX', seedX), centerY: num('centerY', seedY), armLength: num('armLength', 120), spacing: num('spacing', 60), includeCenter: (p as any).includeCenter !== false });
      break;
    default:
      break;
  }

  return members.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), width, height }));
}

