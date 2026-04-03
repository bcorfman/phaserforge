import { coerceTarget, flattenTarget, isFormationGroup } from '../targets/resolveTarget';
import { GroupBounds, RuntimeEntity, RuntimeTarget } from '../targets/types';

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
  return {
    minX: entity.x - entity.width / 2,
    maxX: entity.x + entity.width / 2,
    minY: entity.y - entity.height / 2,
    maxY: entity.y + entity.height / 2,
  };
}

function targetKey(target: RuntimeTarget): string {
  if (isFormationGroup(target)) return `group:${target.id}`;
  return `entity:${target.id}`;
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
      const groupBounds = target.getBounds();
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
    const current = target.getBounds();
    let dx = 0;
    let dy = 0;

    if (sides.x === 'left') {
      dx = this.behavior === 'wrap' ? this.bounds.maxX - current.maxX : this.bounds.minX - current.minX;
    } else if (sides.x === 'right') {
      dx = this.behavior === 'wrap' ? this.bounds.minX - current.minX : this.bounds.maxX - current.maxX;
    }

    if (sides.y === 'bottom') {
      dy = this.behavior === 'wrap' ? this.bounds.maxY - current.maxY : this.bounds.minY - current.minY;
    } else if (sides.y === 'top') {
      dy = this.behavior === 'wrap' ? this.bounds.minY - current.minY : this.bounds.maxY - current.maxY;
    }

    target.translate(dx, dy);

    if (this.behavior === 'limit' || this.behavior === 'stop') {
      if (sides.x) target.stopVelocity('x');
      if (sides.y) target.stopVelocity('y');
      return;
    }

    if (this.behavior === 'bounce') {
      const shouldFlipX = sides.x && sides.x !== previous.x;
      const shouldFlipY = sides.y && sides.y !== previous.y;
      for (const member of target.members) {
        if (shouldFlipX) member.vx = -(member.vx ?? 0);
        if (shouldFlipY) member.vy = -(member.vy ?? 0);
      }
    }
  }

  private applyMemberBehavior(members: RuntimeEntity[]): void {
    for (const member of members) {
      const current = entityBounds(member);
      const sides = this.hitSides(current);

      if (sides.x === 'left') {
        if (this.behavior === 'wrap') {
          member.x += this.bounds.maxX - current.maxX;
        } else {
          member.x += this.bounds.minX - current.minX;
          if (this.behavior === 'limit' || this.behavior === 'stop') member.vx = 0;
          if (this.behavior === 'bounce') member.vx = -(member.vx ?? 0);
        }
      } else if (sides.x === 'right') {
        if (this.behavior === 'wrap') {
          member.x += this.bounds.minX - current.minX;
        } else {
          member.x += this.bounds.maxX - current.maxX;
          if (this.behavior === 'limit' || this.behavior === 'stop') member.vx = 0;
          if (this.behavior === 'bounce') member.vx = -(member.vx ?? 0);
        }
      }

      if (sides.y === 'bottom') {
        if (this.behavior === 'wrap') {
          member.y += this.bounds.maxY - current.maxY;
        } else {
          member.y += this.bounds.minY - current.minY;
          if (this.behavior === 'limit' || this.behavior === 'stop') member.vy = 0;
          if (this.behavior === 'bounce') member.vy = -(member.vy ?? 0);
        }
      } else if (sides.y === 'top') {
        if (this.behavior === 'wrap') {
          member.y += this.bounds.minY - current.minY;
        } else {
          member.y += this.bounds.maxY - current.maxY;
          if (this.behavior === 'limit' || this.behavior === 'stop') member.vy = 0;
          if (this.behavior === 'bounce') member.vy = -(member.vy ?? 0);
        }
      }
    }
  }
}
