import { resolveEntityDefaults, type ResolvedEntitySpec } from '../model/entityDefaults';
import type { EntitySpec } from '../model/types';

export type CommonValue<T> = { kind: 'same'; value: T } | { kind: 'mixed' };

export function getCommonResolvedEntityValue<K extends keyof ResolvedEntitySpec>(
  entities: EntitySpec[],
  key: K
): CommonValue<ResolvedEntitySpec[K]> {
  if (entities.length === 0) return { kind: 'mixed' };

  const firstResolved = resolveEntityDefaults(entities[0]);
  const firstValue = firstResolved[key];

  for (let index = 1; index < entities.length; index += 1) {
    const resolved = resolveEntityDefaults(entities[index]);
    if (resolved[key] !== firstValue) return { kind: 'mixed' };
  }

  return { kind: 'same', value: firstValue };
}

