import { ActionBase } from '../Action';
import type { Condition } from '../conditions/Condition';
import { coerceTarget, flattenTarget } from '../targets/resolveTarget';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export type OffsetFn = (t: number) => readonly [number, number];

export class ParametricMotionUntil extends ActionBase {
  private readonly target: RuntimeTarget;
  private readonly offsetFn: OffsetFn;
  private readonly condition: Condition;
  private readonly durationMs: number;
  private readonly rotateWithPath: boolean;
  private readonly rotationOffsetDeg: number;
  private readonly debug: boolean;
  private readonly debugThreshold: number;
  private readonly onStop?: () => void;

  private factor = 1.0;
  private elapsedMs = 0;
  private readonly origins = new Map<string, { x: number; y: number }>();
  private readonly prevOffsets = new Map<string, { dx: number; dy: number }>();

  constructor(
    targets: RuntimeTarget | RuntimeEntity[],
    offsetFn: OffsetFn,
    condition: Condition,
    opts: {
      durationMs: number;
      rotateWithPath?: boolean;
      rotationOffsetDeg?: number;
      debug?: boolean;
      debugThreshold?: number;
      onStop?: () => void;
    }
  ) {
    super();
    this.target = coerceTarget(targets);
    this.offsetFn = offsetFn;
    this.condition = condition;
    this.durationMs = Math.max(0, Number(opts.durationMs ?? 0));
    this.rotateWithPath = Boolean(opts.rotateWithPath);
    this.rotationOffsetDeg = Number.isFinite(Number(opts.rotationOffsetDeg)) ? Number(opts.rotationOffsetDeg) : 0;
    this.debug = Boolean(opts.debug);
    this.debugThreshold = Number.isFinite(Number(opts.debugThreshold)) ? Number(opts.debugThreshold) : 250;
    this.onStop = opts.onStop;
  }

  setFactor(next: number): void {
    this.factor = Number.isFinite(next) ? next : 1.0;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.elapsedMs = 0;
    this.origins.clear();
    this.prevOffsets.clear();
    this.condition.reset();

    for (const member of flattenTarget(this.target)) {
      this.origins.set(member.id, { x: member.x, y: member.y });
      this.prevOffsets.set(member.id, { dx: 0, dy: 0 });
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;

    const scaled = dtMs * this.factor;
    this.elapsedMs += scaled;
    this.condition.update(scaled);

    const t = this.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, this.elapsedMs / this.durationMs));
    const [dx, dy] = this.offsetFn(t);

    for (const member of flattenTarget(this.target)) {
      const origin = this.origins.get(member.id) ?? { x: member.x, y: member.y };
      member.x = origin.x + dx;
      member.y = origin.y + dy;

      if (this.rotateWithPath) {
        const prev = this.prevOffsets.get(member.id) ?? { dx: 0, dy: 0 };
        const stepDx = dx - prev.dx;
        const stepDy = dy - prev.dy;
        const stepDist = Math.hypot(stepDx, stepDy);
        if (this.debug && stepDist > this.debugThreshold) {
          console.warn(`[ParametricMotionUntil:jump] Δ=${stepDist.toFixed(1)} thr=${this.debugThreshold}`);
        }
        if (Math.abs(stepDx) > 1e-6 || Math.abs(stepDy) > 1e-6) {
          const angleDeg = (Math.atan2(stepDy, stepDx) * 180) / Math.PI;
          member.rotationDeg = angleDeg + this.rotationOffsetDeg;
        }
        this.prevOffsets.set(member.id, { dx, dy });
      }
    }

    if (this.elapsedMs + 1e-9 >= this.durationMs || t >= 1 || this.condition.isMet(this.target)) {
      this.onStop?.();
      this.stop();
    }
  }
}
