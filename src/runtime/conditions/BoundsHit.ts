import { Condition } from './Condition';
import { RuntimeEntity } from '../targets/types';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class BoundsHit implements Condition {
  private bounds: Bounds;
  private mode: 'any' | 'all';

  constructor(bounds: Bounds, mode: 'any' | 'all') {
    this.bounds = bounds;
    this.mode = mode;
  }

  reset(): void {
    // stateless
  }

  update(_dtMs: number): void {
    // stateless
  }

  isMet(targets: RuntimeEntity[]): boolean {
    if (targets.length === 0) return false;

    const hits = targets.map((t) => this.isOutside(t));
    if (this.mode === 'any') {
      return hits.some(Boolean);
    }
    return hits.every(Boolean);
  }

  private isOutside(t: RuntimeEntity): boolean {
    const xHit = t.x <= this.bounds.minX || t.x >= this.bounds.maxX;
    const yHit = t.y <= this.bounds.minY || t.y >= this.bounds.maxY;
    return xHit || yHit;
  }
}
