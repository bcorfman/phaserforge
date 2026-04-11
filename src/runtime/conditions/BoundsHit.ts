import { Condition } from './Condition';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';
import { BoundaryBehavior, BoundaryEngine, BoundaryOptions, BoundaryScope } from '../boundaries/BoundaryEngine';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class BoundsHit implements Condition {
  readonly scope: BoundaryScope;
  readonly behavior: BoundaryBehavior;
  private readonly engine: BoundaryEngine;

  constructor(bounds: Bounds, private mode: 'any' | 'all', options: BoundaryOptions = {}) {
    this.scope = options.scope ?? 'member-any';
    this.behavior = options.behavior ?? 'stop';
    this.engine = new BoundaryEngine(bounds, {
      ...options,
      scope: this.scope,
      behavior: this.behavior,
    });
  }

  reset(): void {
    // stateless
  }

  update(_dtMs: number): void {
    // stateless
  }

  isMet(target: RuntimeTarget | RuntimeEntity[]): boolean {
    if (Array.isArray(target) && target.length === 0) return false;
    return this.engine.isMet(target);
  }

  validateTarget(target: RuntimeTarget | RuntimeEntity[]): void {
    this.engine.validateTargetSpan(target);
  }

  apply(target: RuntimeTarget | RuntimeEntity[]) {
    return this.engine.apply(target);
  }
}
