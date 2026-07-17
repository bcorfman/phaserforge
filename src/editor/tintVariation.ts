import type { GameSceneSpec, Id } from '../model/types';
import { createSeededRandom, randomIntInRange } from '../util/deterministicRandom';

export type TintVariationOptions = {
  scope?: 'all' | 'selection';
  seed: string;
  minR: number;
  maxR: number;
  minG: number;
  maxG: number;
  minB: number;
  maxB: number;
};

export function buildGroupTintVariation(
  scene: GameSceneSpec,
  groupId: Id,
  options: TintVariationOptions,
  selectedIds?: Set<Id>
): Record<Id, number> {
  const group = scene.groups[groupId];
  if (!group) return {};
  const targetIds = group.members.filter((id) => {
    if (!scene.entities[id]) return false;
    if (options.scope !== 'selection') return true;
    return selectedIds ? selectedIds.has(id) : false;
  });
  if (targetIds.length === 0) return {};

  const r = createSeededRandom(options.seed, `formation:${groupId}:tint-r`);
  const g = createSeededRandom(options.seed, `formation:${groupId}:tint-g`);
  const b = createSeededRandom(options.seed, `formation:${groupId}:tint-b`);
  const tints: Record<Id, number> = {};
  for (const id of targetIds) {
    tints[id] =
      (randomIntInRange(r, options.minR, options.maxR) << 16)
      | (randomIntInRange(g, options.minG, options.maxG) << 8)
      | randomIntInRange(b, options.minB, options.maxB);
  }
  return tints;
}
