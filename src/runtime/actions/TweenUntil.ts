import { ActionBase } from '../Action';
import type { Condition } from '../conditions/Condition';
import { coerceTarget } from '../targets/resolveTarget';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

export type TweenEasingId = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export type TweenFromMode = 'current' | 'value';

export interface TweenUntilOptions {
  property: string;
  from: TweenFromMode;
  startValue?: number;
  endValue: number;
  durationMs: number;
  easing?: TweenEasingId;
  condition: Condition;
}

function easingFn(id: TweenEasingId): (t: number) => number {
  if (id === 'easeIn') return (t) => t * t;
  if (id === 'easeOut') return (t) => 1 - (1 - t) * (1 - t);
  if (id === 'easeInOut') return (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  return (t) => t;
}

function coerceFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export class TweenUntil extends ActionBase {
  private target: RuntimeTarget;
  private opts: Required<Pick<TweenUntilOptions, 'property' | 'from' | 'endValue' | 'durationMs' | 'condition'>> & {
    startValue?: number;
    easing: TweenEasingId;
  };
  private elapsedMs = 0;
  private startByEntityId = new Map<string, number>();

  constructor(targets: RuntimeTarget | RuntimeEntity[], options: TweenUntilOptions) {
    super();
    this.target = coerceTarget(targets);
    this.opts = {
      property: options.property,
      from: options.from,
      startValue: options.startValue,
      endValue: options.endValue,
      durationMs: options.durationMs,
      easing: options.easing ?? 'linear',
      condition: options.condition,
    };
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.elapsedMs = 0;
    this.startByEntityId.clear();
    this.opts.condition.reset();

    const durationMs = Math.max(0, coerceFiniteNumber(this.opts.durationMs, 0));
    const endValue = coerceFiniteNumber(this.opts.endValue, 0);
    if (durationMs === 0) {
      this.forEachTargetEntity((entity) => {
        (entity as any)[this.opts.property] = endValue;
      });
      this.stop();
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const durationMs = Math.max(0, coerceFiniteNumber(this.opts.durationMs, 0));
    if (durationMs === 0) return;

    this.elapsedMs += Math.max(0, coerceFiniteNumber(dtMs, 0));
    const t = Math.min(1, this.elapsedMs / durationMs);
    const eased = easingFn(this.opts.easing)(t);

    const endValue = coerceFiniteNumber(this.opts.endValue, 0);
    const fromMode = this.opts.from;
    const explicitStartValue = typeof this.opts.startValue === 'number' && Number.isFinite(this.opts.startValue) ? this.opts.startValue : undefined;

    this.forEachTargetEntity((entity) => {
      const key = entity.id;
      const start = this.startByEntityId.has(key)
        ? this.startByEntityId.get(key)!
        : fromMode === 'value'
          ? coerceFiniteNumber(explicitStartValue, 0)
          : coerceFiniteNumber((entity as any)[this.opts.property], 0);
      if (!this.startByEntityId.has(key)) this.startByEntityId.set(key, start);

      const value = start + (endValue - start) * eased;
      (entity as any)[this.opts.property] = value;
    });

    this.opts.condition.update(dtMs);
    if (this.opts.condition.isMet(this.target) || t >= 1) {
      this.stop();
    }
  }

  reset(): void {
    super.reset();
    this.elapsedMs = 0;
    this.startByEntityId.clear();
    this.opts.condition.reset();
  }

  private forEachTargetEntity(fn: (entity: RuntimeEntity) => void): void {
    if ('members' in this.target) {
      for (const member of this.target.members) fn(member);
      return;
    }
    fn(this.target);
  }
}

