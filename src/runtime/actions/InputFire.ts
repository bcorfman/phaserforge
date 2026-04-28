import { ActionBase } from '../Action';
import type { RuntimeEntity } from '../targets/types';
import type { InputService } from '../services/RuntimeServices';

export class InputFire extends ActionBase {
  private cooldownRemainingMs = 0;

  constructor(
    private readonly shooter: RuntimeEntity,
    private readonly input: InputService,
    private readonly spawn: (opts: {
      templateEntityId: string;
      layer?: 'base' | 'active';
      x?: number;
      y?: number;
      vx?: number;
      vy?: number;
      visible?: boolean;
    }) => string | undefined,
    private readonly opts: {
      fireActionId: string;
      templateEntityId: string;
      layer?: 'base' | 'active';
      cooldownMs: number;
      offsetX: number;
      offsetY: number;
      velocityX: number;
      velocityY: number;
    }
  ) {
    super();
  }

  update(dtMs: number): void {
    this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - dtMs);
    const fire = this.input.getActionState(this.opts.fireActionId);
    if (!fire.pressed) return;
    if (this.cooldownRemainingMs > 0) return;

    this.cooldownRemainingMs = Math.max(0, this.opts.cooldownMs);
    this.spawn({
      templateEntityId: this.opts.templateEntityId,
      ...(this.opts.layer ? { layer: this.opts.layer } : {}),
      x: this.shooter.x + this.opts.offsetX,
      y: this.shooter.y + this.opts.offsetY,
      vx: this.opts.velocityX,
      vy: this.opts.velocityY,
      visible: true,
    });
  }
}
