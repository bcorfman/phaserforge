import { ActionBase } from '../Action';
import type { RuntimeEntity } from '../targets/types';
import type { InputService } from '../services/RuntimeServices';

export class InputDrive extends ActionBase {
  constructor(
    private readonly entity: RuntimeEntity,
    private readonly input: InputService,
    private readonly opts: {
      speedX: number;
      speedY: number;
      leftActionId?: string;
      rightActionId?: string;
      upActionId?: string;
      downActionId?: string;
    }
  ) {
    super();
  }

  update(_dtMs: number): void {
    const left = this.opts.leftActionId ? this.input.getActionState(this.opts.leftActionId).held : false;
    const right = this.opts.rightActionId ? this.input.getActionState(this.opts.rightActionId).held : false;
    const up = this.opts.upActionId ? this.input.getActionState(this.opts.upActionId).held : false;
    const down = this.opts.downActionId ? this.input.getActionState(this.opts.downActionId).held : false;

    const xDir = (right ? 1 : 0) + (left ? -1 : 0);
    const yDir = (down ? 1 : 0) + (up ? -1 : 0);

    this.entity.vx = xDir * this.opts.speedX;
    this.entity.vy = yDir * this.opts.speedY;
  }
}

