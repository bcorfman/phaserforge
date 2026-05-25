import { ActionBase } from '../Action';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class MoveTo extends ActionBase {
  private target: RuntimeTarget;
  private position: { x: number; y: number };

  constructor(targets: RuntimeTarget | RuntimeEntity[], position: { x: number; y: number }) {
    super();
    this.target = coerceTarget(targets);
    this.position = position;
  }

  start(): void {
    if (this.started) return;
    super.start();
    if ('members' in this.target) {
      this.target.setPosition(this.position.x, this.position.y);
      this.stop();
      return;
    }
    this.target.x = this.position.x;
    this.target.y = this.position.y;
    this.stop();
  }
}

