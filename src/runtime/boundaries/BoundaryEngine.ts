import { coerceTarget, flattenTarget, isFormationGroup } from '../targets/resolveTarget';
import { GroupBounds, RuntimeEntity, RuntimeTarget } from '../targets/types';
import { getRotatedEntityBoundaryBounds, getRectSpan } from '../geometry';

export type BoundaryScope = 'member-any' | 'member-all' | 'group-extents';
export type BoundaryBehavior = 'stop' | 'limit' | 'bounce' | 'wrap';
export type BoundarySide = 'left' | 'right' | 'top' | 'bottom';

export interface BoundaryOptions {
  scope?: BoundaryScope;
  behavior?: BoundaryBehavior;
  onEnter?: (target: RuntimeTarget, axis: 'x' | 'y', side: BoundarySide) => void;
  onExit?: (target: RuntimeTarget, axis: 'x' | 'y', side: BoundarySide) => void;
}

export interface BoundaryResult {
  hit: boolean;
  sides: { x?: 'left' | 'right'; y?: 'top' | 'bottom' };
}

function entityBounds(entity: RuntimeEntity): GroupBounds {
  return getRotatedEntityBoundaryBounds(entity);
}

function targetKey(target: RuntimeTarget): string {
  if (isFormationGroup(target)) return `group:${target.id}`;
  return `entity:${target.id}`;
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

function groupBoundaryBounds(group: RuntimeTarget): GroupBounds {
  if (!isFormationGroup(group) || group.members.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return combineBounds(group.members.map((member) => entityBounds(member)));
}

export class BoundaryEngine {
  private activeContacts = new Map<string, { x?: 'left' | 'right'; y?: 'top' | 'bottom' }>();
  readonly scope: BoundaryScope;
  readonly behavior: BoundaryBehavior;

  constructor(
    private readonly bounds: GroupBounds,
    options: BoundaryOptions = {}
  ) {
    this.scope = options.scope ?? 'member-any';
    this.behavior = options.behavior ?? 'stop';
    this.onEnter = options.onEnter;
    this.onExit = options.onExit;
  }

  private readonly onEnter?;
  private readonly onExit?;

  isMet(targetLike: RuntimeTarget | RuntimeEntity[]): boolean {
    const target = coerceTarget(targetLike);
    return this.detect(target).hit;
  }

  validateTargetSpan(targetLike: RuntimeTarget | RuntimeEntity[]): void {
    const target = coerceTarget(targetLike);
    const targets = this.scope === 'group-extents' && isFormationGroup(target)
      ? target.members
      : flattenTarget(target);

    for (const member of targets) {
      const span = getRectSpan(entityBounds(member));
      const xSpan = this.bounds.maxX - this.bounds.minX;
      const ySpan = this.bounds.maxY - this.bounds.minY;
      if (xSpan < span.width) {
        throw new Error(`Horizontal patrol span (${xSpan.toFixed(1)}px) must be >= rotated sprite width (${span.width.toFixed(1)}px)`);
      }
      if (ySpan < span.height) {
        throw new Error(`Vertical patrol span (${ySpan.toFixed(1)}px) must be >= rotated sprite height (${span.height.toFixed(1)}px)`);
      }
    }
  }

  apply(targetLike: RuntimeTarget | RuntimeEntity[]): BoundaryResult {
    const target = coerceTarget(targetLike);
    const detected = this.detect(target);
    const previous = this.activeContacts.get(targetKey(target)) ?? {};
    this.updateContactState(target, detected.sides);
    if (!detected.hit) return detected;

    if (this.scope === 'group-extents' && isFormationGroup(target)) {
      this.applyGroupBehavior(target, detected.sides, previous);
    } else {
      this.applyMemberBehavior(flattenTarget(target));
    }

    return detected;
  }

  private detect(target: RuntimeTarget): BoundaryResult {
    if (this.scope === 'group-extents' && isFormationGroup(target)) {
      const groupBounds = groupBoundaryBounds(target);
      return {
        hit: this.hasHit(groupBounds),
        sides: this.hitSides(groupBounds),
      };
    }

    const members = flattenTarget(target);
    const hits = members.map((member) => {
      const bounds = entityBounds(member);
      return {
        hit: this.hasHit(bounds),
        sides: this.hitSides(bounds),
      };
    });

    if (this.scope === 'member-all') {
      return {
        hit: hits.length > 0 && hits.every((entry) => entry.hit),
        sides: this.mergeSides(hits.map((entry) => entry.sides)),
      };
    }

    return {
      hit: hits.some((entry) => entry.hit),
      sides: this.mergeSides(hits.map((entry) => entry.sides)),
    };
  }

  private hasHit(current: GroupBounds): boolean {
    return current.minX <= this.bounds.minX
      || current.maxX >= this.bounds.maxX
      || current.minY <= this.bounds.minY
      || current.maxY >= this.bounds.maxY;
  }

  private hitSides(current: GroupBounds): BoundaryResult['sides'] {
    const sides: BoundaryResult['sides'] = {};
    if (current.minX <= this.bounds.minX) sides.x = 'left';
    else if (current.maxX >= this.bounds.maxX) sides.x = 'right';

    if (current.minY <= this.bounds.minY) sides.y = 'bottom';
    else if (current.maxY >= this.bounds.maxY) sides.y = 'top';

    return sides;
  }

  private mergeSides(sides: BoundaryResult['sides'][]): BoundaryResult['sides'] {
    const merged: BoundaryResult['sides'] = {};
    for (const side of sides) {
      if (!merged.x && side.x) merged.x = side.x;
      if (!merged.y && side.y) merged.y = side.y;
    }
    return merged;
  }

  private updateContactState(target: RuntimeTarget, next: BoundaryResult['sides']): void {
    const key = targetKey(target);
    const previous = this.activeContacts.get(key) ?? {};

    if (previous.x && previous.x !== next.x) {
      this.onExit?.(target, 'x', previous.x);
    }
    if (previous.y && previous.y !== next.y) {
      this.onExit?.(target, 'y', previous.y);
    }
    if (next.x && next.x !== previous.x) {
      this.onEnter?.(target, 'x', next.x);
    }
    if (next.y && next.y !== previous.y) {
      this.onEnter?.(target, 'y', next.y);
    }

    this.activeContacts.set(key, next);
  }

  private applyGroupBehavior(
    target: RuntimeTarget,
    sides: BoundaryResult['sides'],
    previous: BoundaryResult['sides']
  ): void {
    if (!isFormationGroup(target)) return;
    const current = groupBoundaryBounds(target);
    const members = target.members;
    const movingOutX = sides.x === 'left'
      ? members.some((member) => (member.vx ?? 0) < 0)
      : sides.x === 'right'
        ? members.some((member) => (member.vx ?? 0) > 0)
        : false;
    const movingOutY = sides.y === 'bottom'
      ? members.some((member) => (member.vy ?? 0) < 0)
      : sides.y === 'top'
        ? members.some((member) => (member.vy ?? 0) > 0)
        : false;

    let dx = 0;
    let dy = 0;

    if (sides.x === 'left') {
      if (this.behavior === 'wrap') {
        dx = movingOutX
          ? this.bounds.maxX - current.maxX
          : current.minX < this.bounds.minX
            ? this.bounds.minX - current.minX
            : 0;
      } else {
        dx = this.bounds.minX - current.minX;
      }
    } else if (sides.x === 'right') {
      if (this.behavior === 'wrap') {
        dx = movingOutX
          ? this.bounds.minX - current.minX
          : current.maxX > this.bounds.maxX
            ? this.bounds.maxX - current.maxX
            : 0;
      } else {
        dx = this.bounds.maxX - current.maxX;
      }
    }

    if (sides.y === 'bottom') {
      if (this.behavior === 'wrap') {
        dy = movingOutY
          ? this.bounds.maxY - current.maxY
          : current.minY < this.bounds.minY
            ? this.bounds.minY - current.minY
            : 0;
      } else {
        dy = this.bounds.minY - current.minY;
      }
    } else if (sides.y === 'top') {
      if (this.behavior === 'wrap') {
        dy = movingOutY
          ? this.bounds.minY - current.minY
          : current.maxY > this.bounds.maxY
            ? this.bounds.maxY - current.maxY
            : 0;
      } else {
        dy = this.bounds.maxY - current.maxY;
      }
    }

    target.translate(dx, dy);

    if (this.behavior === 'limit' || this.behavior === 'stop') {
      if (sides.x && movingOutX) {
        for (const member of target.members) {
          const vx = member.vx ?? 0;
          if (sides.x === 'left' ? vx < 0 : vx > 0) member.vx = 0;
        }
      }
      if (sides.y && movingOutY) {
        for (const member of target.members) {
          const vy = member.vy ?? 0;
          if (sides.y === 'bottom' ? vy < 0 : vy > 0) member.vy = 0;
        }
      }
      return;
    }

    if (this.behavior === 'bounce') {
      const shouldFlipX = sides.x && sides.x !== previous.x;
      const shouldFlipY = sides.y && sides.y !== previous.y;
      for (const member of target.members) {
        if (shouldFlipX && sides.x) {
          const vx = member.vx ?? 0;
          const movingOut = sides.x === 'left' ? vx < 0 : vx > 0;
          if (movingOut) member.vx = -vx;
        }
        if (shouldFlipY && sides.y) {
          const vy = member.vy ?? 0;
          const movingOut = sides.y === 'bottom' ? vy < 0 : vy > 0;
          if (movingOut) member.vy = -vy;
        }
      }
    }
  }

  private applyMemberBehavior(members: RuntimeEntity[]): void {
    for (const member of members) {
      const current = entityBounds(member);
      const sides = this.hitSides(current);
      const vx = member.vx ?? 0;
      const vy = member.vy ?? 0;
      const movingOutX = sides.x === 'left'
        ? vx < 0
        : sides.x === 'right'
          ? vx > 0
          : false;
      const movingOutY = sides.y === 'bottom'
        ? vy < 0
        : sides.y === 'top'
          ? vy > 0
          : false;

      if (sides.x === 'left') {
        if (this.behavior === 'wrap') {
          if (movingOutX) {
            member.x += this.bounds.maxX - current.maxX;
          } else {
            member.x += this.bounds.minX - current.minX;
          }
        } else {
          member.x += this.bounds.minX - current.minX;
          if ((this.behavior === 'limit' || this.behavior === 'stop') && movingOutX) member.vx = 0;
          if (this.behavior === 'bounce' && movingOutX) member.vx = -vx;
        }
      } else if (sides.x === 'right') {
        if (this.behavior === 'wrap') {
          if (movingOutX) {
            member.x += this.bounds.minX - current.minX;
          } else {
            member.x += this.bounds.maxX - current.maxX;
          }
        } else {
          member.x += this.bounds.maxX - current.maxX;
          if ((this.behavior === 'limit' || this.behavior === 'stop') && movingOutX) member.vx = 0;
          if (this.behavior === 'bounce' && movingOutX) member.vx = -vx;
        }
      }

      if (sides.y === 'bottom') {
        if (this.behavior === 'wrap') {
          if (movingOutY) {
            member.y += this.bounds.maxY - current.maxY;
          } else {
            member.y += this.bounds.minY - current.minY;
          }
        } else {
          member.y += this.bounds.minY - current.minY;
          if ((this.behavior === 'limit' || this.behavior === 'stop') && movingOutY) member.vy = 0;
          if (this.behavior === 'bounce' && movingOutY) member.vy = -vy;
        }
      } else if (sides.y === 'top') {
        if (this.behavior === 'wrap') {
          if (movingOutY) {
            member.y += this.bounds.minY - current.minY;
          } else {
            member.y += this.bounds.maxY - current.maxY;
          }
        } else {
          member.y += this.bounds.maxY - current.maxY;
          if ((this.behavior === 'limit' || this.behavior === 'stop') && movingOutY) member.vy = 0;
          if (this.behavior === 'bounce' && movingOutY) member.vy = -vy;
        }
      }
    }
  }
}
