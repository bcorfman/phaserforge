import { ActionBase } from '../Action';
import { Condition } from '../conditions/Condition';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

type Frame = string | number;

export class CycleFramesUntil extends ActionBase {
  private readonly target: RuntimeTarget;
  private readonly frames: Frame[];
  private readonly fps: number;
  private readonly direction: 1 | -1;
  private readonly condition: Condition;
  private frameIndex = 0;
  private cursorMs = 0;

  constructor(
    targets: RuntimeTarget | RuntimeEntity[],
    opts: {
      frames: Frame[];
      fps: number;
      direction?: 1 | -1;
      condition: Condition;
    }
  ) {
    super();
    this.target = coerceTarget(targets);
    this.frames = opts.frames;
    if (!Array.isArray(this.frames) || this.frames.length === 0) {
      throw new Error('CycleFramesUntil requires at least one frame');
    }
    const fps = Number(opts.fps);
    if (!Number.isFinite(fps) || fps <= 0) throw new Error('CycleFramesUntil requires fps > 0');
    this.fps = fps;
    this.direction = opts.direction ?? 1;
    this.condition = opts.condition;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.cursorMs = 0;
    this.frameIndex = 0;
    this.applyFrame();
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.condition.update(dtMs);
    if (this.condition.isMet(this.target)) {
      this.stop();
      return;
    }

    const frameMs = 1000 / this.fps;
    this.cursorMs += dtMs;
    const maxSteps = 12;
    let steps = 0;
    while (this.cursorMs >= frameMs && steps < maxSteps) {
      this.cursorMs -= frameMs;
      this.step();
      steps += 1;
    }
  }

  reset(): void {
    super.reset();
    this.cursorMs = 0;
    this.frameIndex = 0;
    this.condition.reset();
  }

  private step(): void {
    const next = (this.frameIndex + this.direction + this.frames.length) % this.frames.length;
    this.frameIndex = next;
    this.applyFrame();
  }

  private applyFrame(): void {
    const frame = this.frames[this.frameIndex];
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      (target as any).frame = frame;
    }
  }
}

