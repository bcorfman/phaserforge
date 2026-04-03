import { TargetRef } from '../../model/types';
import { RuntimeEntity, RuntimeGroup, RuntimeTarget } from './types';

export interface TargetContext {
  entities: Record<string, RuntimeEntity>;
  groups: Record<string, RuntimeGroup>;
}

export function resolveTarget(ref: TargetRef, ctx: TargetContext): RuntimeTarget {
  if (ref.type === 'entity') {
    const entity = ctx.entities[ref.entityId];
    if (!entity) {
      throw new Error(`Unknown entity target: ${ref.entityId}`);
    }
    return entity;
  }

  const group = ctx.groups[ref.groupId];
  if (!group) {
    throw new Error(`Unknown group target: ${ref.groupId}`);
  }
  return group;
}

export function flattenTarget(target: RuntimeTarget): RuntimeEntity[] {
  if ('members' in target) return target.members;
  return [target];
}
