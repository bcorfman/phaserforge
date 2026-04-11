import { FormationGroup, GroupBounds, RuntimeEntity } from './types';
import { getRotatedEntityBounds } from '../geometry';

function entityBoundsAt(member: RuntimeEntity, x: number, y: number): GroupBounds {
  return getRotatedEntityBounds({
    ...member,
    x,
    y,
  });
}

function combineBounds(bounds: GroupBounds[]): GroupBounds {
  return bounds.reduce(
    (acc, next) => ({
      minX: Math.min(acc.minX, next.minX),
      maxX: Math.max(acc.maxX, next.maxX),
      minY: Math.min(acc.minY, next.minY),
      maxY: Math.max(acc.maxY, next.maxY),
    }),
    bounds[0]
  );
}

function ensureRuntimeMetadata(member: RuntimeEntity): RuntimeEntity {
  if (member.homeX === undefined) member.homeX = member.x;
  if (member.homeY === undefined) member.homeY = member.y;
  if (member.vx === undefined) member.vx = 0;
  if (member.vy === undefined) member.vy = 0;
  return member;
}

export function createFormationGroup(id: string, members: RuntimeEntity[]): FormationGroup {
  const normalized = members.map((member) => ensureRuntimeMetadata(member));
  const homeSlots = Object.fromEntries(
    normalized.map((member) => [member.id, { x: member.homeX!, y: member.homeY! }])
  );

  const getBounds = (): GroupBounds => {
    if (normalized.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    return combineBounds(normalized.map((member) => entityBoundsAt(member, member.x, member.y)));
  };

  const getHomeBounds = (): GroupBounds => {
    if (normalized.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    return combineBounds(
      normalized.map((member) => {
        const home = homeSlots[member.id];
        return entityBoundsAt(member, home.x, home.y);
      })
    );
  };

  const translate = (dx: number, dy: number): void => {
    for (const member of normalized) {
      member.x += dx;
      member.y += dy;
    }
  };

  const setPosition = (x: number, y: number): void => {
    const bounds = getBounds();
    const currentX = (bounds.minX + bounds.maxX) / 2;
    const currentY = (bounds.minY + bounds.maxY) / 2;
    translate(x - currentX, y - currentY);
  };

  const setVelocity = (vx: number, vy: number): void => {
    for (const member of normalized) {
      member.vx = vx;
      member.vy = vy;
    }
  };

  const stopVelocity = (axis?: 'x' | 'y'): void => {
    for (const member of normalized) {
      if (!axis || axis === 'x') member.vx = 0;
      if (!axis || axis === 'y') member.vy = 0;
    }
  };

  return {
    id,
    members: normalized,
    homeSlots,
    getBounds,
    getHomeBounds,
    translate,
    setPosition,
    setVelocity,
    stopVelocity,
    forEachMember(fn: (member: RuntimeEntity) => void): void {
      normalized.forEach(fn);
    },
    getMember(entityId: string): RuntimeEntity | undefined {
      return normalized.find((member) => member.id === entityId);
    },
  };
}
