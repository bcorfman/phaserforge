import { coerceTarget, flattenTarget, isFormationGroup } from '../targets/resolveTarget';
import { GroupBounds, RuntimeEntity, RuntimeTarget } from '../targets/types';
import { getRotatedEntityBoundaryBounds, getRectSpan } from '../geometry';
import type { BoundsEventOutcome } from '../events';

export type BoundaryScope = 'member-any' | 'member-all' | 'group-extents';
export type BoundaryBehavior = 'stop' | 'limit' | 'bounce' | 'wrap';
export type BoundarySide = 'left' | 'right' | 'top' | 'bottom';

export interface BoundaryEvent {
  family: 'bounds';
  outcome: BoundsEventOutcome;
  source: RuntimeTarget;
  axis: 'x' | 'y';
  side: BoundarySide;
  priorPosition?: { x: number; y: number };
  position?: { x: number; y: number };
}

export interface BoundaryOptions {
  scope?: BoundaryScope;
  behavior?: BoundaryBehavior;
  onEnter?: (target: RuntimeTarget, axis: 'x' | 'y', side: BoundarySide) => void;
  onExit?: (target: RuntimeTarget, axis: 'x' | 'y', side: BoundarySide) => void;
  onEvent?: (event: BoundaryEvent) => void;
}

export interface BoundaryResult {
  hit: boolean;
  sides: { x?: 'left' | 'right'; y?: 'top' | 'bottom' };
}

type BoundaryAxis = 'x' | 'y';
type BoundaryContacts = BoundaryResult['sides'];

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
    this.onEvent = options.onEvent;
  }

  private readonly onEnter?;
  private readonly onExit?;
  private readonly onEvent?;

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

    if (this.scope === 'group-extents' && isFormationGroup(target)) {
      if (!detected.hit) {
        this.updateContactState(target, detected.sides);
        return detected;
      }
      this.applyGroupBehavior(target, detected.sides);
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
    this.updateAxisContact(target, 'x', next.x);
    this.updateAxisContact(target, 'y', next.y);
  }

  private updateAxisContact(
    target: RuntimeTarget,
    axis: BoundaryAxis,
    nextSide: BoundaryContacts[BoundaryAxis]
  ): BoundaryContacts[BoundaryAxis] {
    const key = targetKey(target);
    const previous = this.activeContacts.get(key) ?? {};
    const previousSide = previous[axis];

    if (previousSide && previousSide !== nextSide) {
      this.onExit?.(target, axis, previousSide);
      this.onEvent?.({ family: 'bounds', outcome: 'contact-exited', source: target, axis, side: previousSide });
    }
    if (nextSide && nextSide !== previousSide) {
      this.onEnter?.(target, axis, nextSide);
      this.onEvent?.({ family: 'bounds', outcome: 'contact-entered', source: target, axis, side: nextSide });
    }

    this.activeContacts.set(key, { ...previous, [axis]: nextSide });
    return previousSide;
  }

  private finishAxisContactAfterBehavior(
    target: RuntimeTarget,
    axis: BoundaryAxis,
    beforeSide: BoundaryContacts[BoundaryAxis]
  ): void {
    const key = targetKey(target);
    const after = this.scope === 'group-extents' && isFormationGroup(target)
      ? this.hitSides(groupBoundaryBounds(target))
      : this.hitSides(entityBounds(target as RuntimeEntity));
    const current = this.activeContacts.get(key) ?? {};
    const currentSide = current[axis] ?? beforeSide;
    const afterSide = after[axis];

    if (currentSide && currentSide !== afterSide) {
      this.onExit?.(target, axis, currentSide);
      this.onEvent?.({ family: 'bounds', outcome: 'contact-exited', source: target, axis, side: currentSide });
    }
    this.activeContacts.set(key, { ...current, [axis]: afterSide });
  }

  private emitOutcome(
    target: RuntimeTarget,
    outcome: BoundsEventOutcome,
    axis: BoundaryAxis,
    side: BoundarySide,
    priorPosition?: { x: number; y: number }
  ): void {
    this.onEvent?.({
      family: 'bounds',
      outcome,
      source: target,
      axis,
      side,
      priorPosition,
      position: 'x' in target && 'y' in target ? { x: target.x, y: target.y } : undefined,
    });
  }

  private applyGroupBehavior(
    target: RuntimeTarget,
    sides: BoundaryResult['sides']
  ): void {
    if (!isFormationGroup(target)) return;
    const members = target.members;
    const initialMovingOutX = sides.x === 'left'
      ? members.some((member) => (member.vx ?? 0) < 0)
      : sides.x === 'right'
        ? members.some((member) => (member.vx ?? 0) > 0)
        : false;
    const initialMovingOutY = sides.y === 'bottom'
      ? members.some((member) => (member.vy ?? 0) < 0)
      : sides.y === 'top'
        ? members.some((member) => (member.vy ?? 0) > 0)
        : false;

    if (sides.x === 'left') {
      const previousSide = this.updateAxisContact(target, 'x', sides.x);
      const current = groupBoundaryBounds(target);
      let dx = 0;
      if (this.behavior === 'wrap') {
        dx = initialMovingOutX
          ? this.bounds.maxX - current.maxX
          : current.minX < this.bounds.minX
            ? this.bounds.minX - current.minX
            : 0;
      } else {
        dx = this.bounds.minX - current.minX;
      }
      target.translate(dx, 0);
      this.applyGroupAxisOutcome(target, 'x', sides.x, initialMovingOutX, previousSide);
      this.finishAxisContactAfterBehavior(target, 'x', sides.x);
    } else if (sides.x === 'right') {
      const previousSide = this.updateAxisContact(target, 'x', sides.x);
      const current = groupBoundaryBounds(target);
      let dx = 0;
      if (this.behavior === 'wrap') {
        dx = initialMovingOutX
          ? this.bounds.minX - current.minX
          : current.maxX > this.bounds.maxX
            ? this.bounds.maxX - current.maxX
            : 0;
      } else {
        dx = this.bounds.maxX - current.maxX;
      }
      target.translate(dx, 0);
      this.applyGroupAxisOutcome(target, 'x', sides.x, initialMovingOutX, previousSide);
      this.finishAxisContactAfterBehavior(target, 'x', sides.x);
    } else {
      this.updateAxisContact(target, 'x', undefined);
    }

    if (sides.y === 'bottom') {
      const previousSide = this.updateAxisContact(target, 'y', sides.y);
      const current = groupBoundaryBounds(target);
      let dy = 0;
      if (this.behavior === 'wrap') {
        dy = initialMovingOutY
          ? this.bounds.maxY - current.maxY
          : current.minY < this.bounds.minY
            ? this.bounds.minY - current.minY
            : 0;
      } else {
        dy = this.bounds.minY - current.minY;
      }
      target.translate(0, dy);
      this.applyGroupAxisOutcome(target, 'y', sides.y, initialMovingOutY, previousSide);
      this.finishAxisContactAfterBehavior(target, 'y', sides.y);
    } else if (sides.y === 'top') {
      const previousSide = this.updateAxisContact(target, 'y', sides.y);
      const current = groupBoundaryBounds(target);
      let dy = 0;
      if (this.behavior === 'wrap') {
        dy = initialMovingOutY
          ? this.bounds.minY - current.minY
          : current.maxY > this.bounds.maxY
            ? this.bounds.maxY - current.maxY
            : 0;
      } else {
        dy = this.bounds.maxY - current.maxY;
      }
      target.translate(0, dy);
      this.applyGroupAxisOutcome(target, 'y', sides.y, initialMovingOutY, previousSide);
      this.finishAxisContactAfterBehavior(target, 'y', sides.y);
    } else {
      this.updateAxisContact(target, 'y', undefined);
    }
  }

  private applyGroupAxisOutcome(
    target: RuntimeTarget,
    axis: BoundaryAxis,
    side: BoundarySide,
    movingOut: boolean,
    previousSide: BoundaryContacts[BoundaryAxis]
  ): void {
    if (!isFormationGroup(target)) return;
    if (this.behavior === 'limit' || this.behavior === 'stop') {
      if (movingOut) {
        for (const member of target.members) {
          if (axis === 'x') {
            const vx = member.vx ?? 0;
            if (side === 'left' ? vx < 0 : vx > 0) member.vx = 0;
          } else {
            const vy = member.vy ?? 0;
            if (side === 'bottom' ? vy < 0 : vy > 0) member.vy = 0;
          }
        }
        this.emitOutcome(target, this.behavior === 'stop' ? 'stopped' : 'clamped', axis, side);
      }
      return;
    }

    if (this.behavior === 'wrap') {
      if (movingOut) this.emitOutcome(target, 'wrapped', axis, side);
      return;
    }

    if (this.behavior === 'bounce' && movingOut && side !== previousSide) {
      for (const member of target.members) {
        if (axis === 'x') {
          const vx = member.vx ?? 0;
          if (side === 'left' ? vx < 0 : vx > 0) member.vx = -vx;
        } else {
          const vy = member.vy ?? 0;
          if (side === 'bottom' ? vy < 0 : vy > 0) member.vy = -vy;
        }
      }
      this.emitOutcome(target, 'bounced', axis, side);
    }
  }

  private applyMemberBehavior(members: RuntimeEntity[]): void {
    for (const member of members) {
      const current = entityBounds(member);
      const sides = this.hitSides(current);
      if (!sides.x && !sides.y) {
        this.updateContactState(member, sides);
        continue;
      }

      this.applyMemberAxisBehavior(member, current, 'x', sides.x);
      this.applyMemberAxisBehavior(member, current, 'y', sides.y);
    }
  }

  private applyMemberAxisBehavior(
    member: RuntimeEntity,
    current: GroupBounds,
    axis: BoundaryAxis,
    side: BoundaryContacts[BoundaryAxis]
  ): void {
    if (!side) {
      this.updateAxisContact(member, axis, undefined);
      return;
    }

    const previousSide = this.updateAxisContact(member, axis, side);
    const vx = member.vx ?? 0;
    const vy = member.vy ?? 0;
    const movingOut = axis === 'x'
      ? side === 'left'
        ? vx < 0
        : vx > 0
      : side === 'bottom'
        ? vy < 0
        : vy > 0;
    const priorPosition = { x: member.x, y: member.y };

    if (axis === 'x') {
      if (side === 'left') {
        if (this.behavior === 'wrap') {
          member.x += movingOut ? this.bounds.maxX - current.maxX : this.bounds.minX - current.minX;
        } else {
          member.x += this.bounds.minX - current.minX;
        }
      } else {
        if (this.behavior === 'wrap') {
          member.x += movingOut ? this.bounds.minX - current.minX : this.bounds.maxX - current.maxX;
        } else {
          member.x += this.bounds.maxX - current.maxX;
        }
      }
    } else if (side === 'bottom') {
      if (this.behavior === 'wrap') {
        member.y += movingOut ? this.bounds.maxY - current.maxY : this.bounds.minY - current.minY;
      } else {
        member.y += this.bounds.minY - current.minY;
      }
    } else {
      if (this.behavior === 'wrap') {
        member.y += movingOut ? this.bounds.minY - current.minY : this.bounds.maxY - current.maxY;
      } else {
        member.y += this.bounds.maxY - current.maxY;
      }
    }

    if (this.behavior === 'wrap') {
      if (movingOut) this.emitOutcome(member, 'wrapped', axis, side, priorPosition);
    } else if ((this.behavior === 'limit' || this.behavior === 'stop') && movingOut) {
      if (axis === 'x') member.vx = 0;
      else member.vy = 0;
      this.emitOutcome(member, this.behavior === 'stop' ? 'stopped' : 'clamped', axis, side, priorPosition);
    } else if (this.behavior === 'bounce' && movingOut && side !== previousSide) {
      if (axis === 'x') member.vx = -vx;
      else member.vy = -vy;
      this.emitOutcome(member, 'bounced', axis, side, priorPosition);
    }

    this.finishAxisContactAfterBehavior(member, axis, side);
  }
}
