import { TargetRef } from '../../model/types';
import { RuntimeEntity, RuntimeGroup, RuntimeTarget, FormationGroup } from './types';

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

export function isFormationGroup(target: RuntimeTarget | RuntimeEntity[]): target is FormationGroup {
  return !Array.isArray(target) && 'members' in target;
}

export function coerceTarget(target: RuntimeTarget | RuntimeEntity[]): RuntimeTarget {
  if (Array.isArray(target)) {
    if (target.length === 1) return target[0];
    return {
      id: '__anonymous_group__',
      members: target,
      homeSlots: Object.fromEntries(
        target.map((member) => [member.id, { x: member.homeX ?? member.x, y: member.homeY ?? member.y }])
      ),
      getBounds() {
        const edges = target.map((member) => ({
          minX: member.x - member.width / 2,
          maxX: member.x + member.width / 2,
          minY: member.y - member.height / 2,
          maxY: member.y + member.height / 2,
        }));
        return edges.reduce(
          (acc, next) => ({
            minX: Math.min(acc.minX, next.minX),
            maxX: Math.max(acc.maxX, next.maxX),
            minY: Math.min(acc.minY, next.minY),
            maxY: Math.max(acc.maxY, next.maxY),
          }),
          edges[0]
        );
      },
      getHomeBounds() {
        const edges = target.map((member) => ({
          minX: (member.homeX ?? member.x) - member.width / 2,
          maxX: (member.homeX ?? member.x) + member.width / 2,
          minY: (member.homeY ?? member.y) - member.height / 2,
          maxY: (member.homeY ?? member.y) + member.height / 2,
        }));
        return edges.reduce(
          (acc, next) => ({
            minX: Math.min(acc.minX, next.minX),
            maxX: Math.max(acc.maxX, next.maxX),
            minY: Math.min(acc.minY, next.minY),
            maxY: Math.max(acc.maxY, next.maxY),
          }),
          edges[0]
        );
      },
      translate(dx: number, dy: number) {
        target.forEach((member) => {
          member.x += dx;
          member.y += dy;
        });
      },
      setPosition() {
        throw new Error('setPosition not supported on anonymous groups');
      },
      setVelocity(vx: number, vy: number) {
        target.forEach((member) => {
          member.vx = vx;
          member.vy = vy;
        });
      },
      stopVelocity(axis?: 'x' | 'y') {
        target.forEach((member) => {
          if (!axis || axis === 'x') member.vx = 0;
          if (!axis || axis === 'y') member.vy = 0;
        });
      },
      forEachMember(fn: (member: RuntimeEntity) => void) {
        target.forEach(fn);
      },
      getMember(entityId: string) {
        return target.find((member) => member.id === entityId);
      },
    };
  }
  return target;
}
