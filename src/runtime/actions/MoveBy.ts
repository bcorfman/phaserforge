import { ActionBase } from '../Action';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class MoveBy extends ActionBase {
  private target: RuntimeTarget;
  private offset: { dx: number; dy: number };

  constructor(targets: RuntimeTarget | RuntimeEntity[], offset: { dx: number; dy: number }) {
    super();
    this.target = coerceTarget(targets);
    this.offset = offset;
  }

  start(): void {
    if (this.started) return;
    super.start();
    if ('members' in this.target) {
      this.target.translate(this.offset.dx, this.offset.dy);
      this.stop();
      return;
    }
    this.target.x += this.offset.dx;
    this.target.y += this.offset.dy;
    this.stop();
  }
}

