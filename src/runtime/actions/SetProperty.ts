import { ActionBase } from '../Action';
import { coerceTarget, flattenTarget } from '../targets/resolveTarget';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';
import { createSeededRandom, randomFloatInRange, randomIntInRange } from '../../util/deterministicRandom';

export type SetPropertyKey = 'x' | 'y' | 'tint' | 'alpha' | 'visible' | 'vx' | 'vy';

export type ValueSource =
  | { kind: 'constant'; value: number | boolean }
  | { kind: 'randomRange'; min: number; max: number; seed: string | number; integer?: boolean; stream?: string };

function resolveValue(source: ValueSource, occurrence: string): number | boolean {
  if (source.kind === 'constant') return source.value;
  const random = createSeededRandom(source.seed, `${source.stream ?? 'set-property'}:${occurrence}`);
  return source.integer
    ? randomIntInRange(random, source.min, source.max)
    : randomFloatInRange(random, source.min, source.max);
}

function applyToEntity(entity: RuntimeEntity, property: SetPropertyKey, value: number | boolean): void {
  switch (property) {
    case 'visible':
      entity.visible = Boolean(value);
      return;
    case 'tint': {
      const tint = Number(value);
      if (Number.isInteger(tint) && tint >= 0 && tint <= 0xffffff) entity.tint = tint;
      return;
    }
    case 'alpha':
      entity.alpha = Math.max(0, Math.min(1, Number(value) || 0));
      return;
    case 'x':
    case 'y':
    case 'vx':
    case 'vy': {
      const next = Number(value);
      if (Number.isFinite(next)) entity[property] = next;
      return;
    }
  }
}

export class SetProperty extends ActionBase {
  private readonly target: RuntimeTarget;

  constructor(target: RuntimeTarget | RuntimeEntity[], private readonly property: SetPropertyKey, private readonly source: ValueSource) {
    super();
    this.target = coerceTarget(target);
  }

  start(): void {
    if (this.started) return;
    super.start();
    const members = flattenTarget(this.target);
    members.forEach((member, index) => {
      applyToEntity(member, this.property, resolveValue(this.source, member.id ?? String(index)));
    });
    this.stop();
  }
}
