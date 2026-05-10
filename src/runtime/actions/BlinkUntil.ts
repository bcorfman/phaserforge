import { ActionBase } from '../Action';
import { Condition } from '../conditions/Condition';
import { coerceTarget } from '../targets/resolveTarget';
import { RuntimeEntity, RuntimeTarget } from '../targets/types';

export class BlinkUntil extends ActionBase {
  private readonly target: RuntimeTarget;
  private readonly secondsUntilChange: number;
  private readonly startVisible: boolean;
  private readonly condition: Condition;
  private readonly onEnterVisible?: () => void;
  private readonly onExitVisible?: () => void;
  private elapsedMs = 0;
  private currentVisible: boolean;

  constructor(
    targets: RuntimeTarget | RuntimeEntity[],
    opts: {
      secondsUntilChange: number;
      startVisible?: boolean;
      condition: Condition;
      onEnterVisible?: () => void;
      onExitVisible?: () => void;
    }
  ) {
    super();
    this.target = coerceTarget(targets);
    this.secondsUntilChange = Number(opts.secondsUntilChange);
    if (!Number.isFinite(this.secondsUntilChange) || this.secondsUntilChange <= 0) {
      throw new Error('BlinkUntil requires secondsUntilChange > 0');
    }
    this.startVisible = opts.startVisible ?? true;
    this.condition = opts.condition;
    this.onEnterVisible = opts.onEnterVisible;
    this.onExitVisible = opts.onExitVisible;
    this.currentVisible = this.startVisible;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.condition.reset();
    this.elapsedMs = 0;
    this.currentVisible = this.startVisible;
    this.setTargetVisible(this.startVisible);
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.condition.update(dtMs);

    this.elapsedMs += dtMs;
    const intervalMs = this.secondsUntilChange * 1000;
    while (this.elapsedMs >= intervalMs) {
      this.elapsedMs -= intervalMs;
      this.toggle();
    }

    if (this.condition.isMet(this.target)) {
      this.stop();
    }
  }

  reset(): void {
    super.reset();
    this.elapsedMs = 0;
    this.currentVisible = this.startVisible;
    this.condition.reset();
  }

  protected removeEffect(): void {
    // Deterministic cleanup: restore to configured startVisible.
    this.setTargetVisible(this.startVisible);
  }

  private toggle(): void {
    this.currentVisible = !this.currentVisible;
    this.setTargetVisible(this.currentVisible);
    if (this.currentVisible) {
      this.onEnterVisible?.();
    } else {
      this.onExitVisible?.();
    }
  }

  private setTargetVisible(visible: boolean): void {
    const targets = 'members' in this.target ? this.target.members : [this.target];
    for (const target of targets) {
      target.visible = visible;
    }
  }
}

