import { ActionBase, type ActionStartContext } from '../Action';
import { coerceTarget, flattenTarget } from '../targets/resolveTarget';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';
import { createSeededRandom, randomFloatInRange, randomIntInRange } from '../../util/deterministicRandom';
import type { ValueSourceSpec } from '../../model/types';

export type SetPropertyKey = 'x' | 'y' | 'tint' | 'alpha' | 'visible' | 'vx' | 'vy';

export type ValueSource = ValueSourceSpec & { stream?: string };

function resolveValue(source: ValueSource, occurrence: string, context?: ActionStartContext): number | string | boolean | undefined {
  if (source.kind === 'constant') return source.value;
  if (source.kind === 'randomRange') {
    const random = createSeededRandom(source.seed, `${source.stream ?? 'set-property'}:${occurrence}`);
    return source.integer
      ? randomIntInRange(random, source.min, source.max)
      : randomFloatInRange(random, source.min, source.max);
  }
  const event = context?.event;
  if (!event) return undefined;
  switch (source.field) {
    case 'sourceId':
      return event.source?.entityId ?? event.source?.target?.entityId ?? event.source?.target?.groupId ?? event.source?.targetKey;
    case 'outcome':
      return event.type;
    case 'axis':
      return event.family === 'bounds' ? event.details.axis : undefined;
    case 'side':
      return event.family === 'bounds' ? event.details.side : undefined;
    case 'positionX':
      return event.family === 'bounds' ? event.details.position?.x : undefined;
    case 'positionY':
      return event.family === 'bounds' ? event.details.position?.y : undefined;
    case 'priorPositionX':
      return event.family === 'bounds' ? event.details.priorPosition?.x : undefined;
    case 'priorPositionY':
      return event.family === 'bounds' ? event.details.priorPosition?.y : undefined;
  }
}

function applyToEntity(entity: RuntimeEntity, property: SetPropertyKey, value: number | string | boolean | undefined): void {
  if (value === undefined) return;
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

  start(context?: ActionStartContext): void {
    if (this.started) return;
    super.start(context);
    const members = flattenTarget(this.target);
    const occurrenceId = context?.event?.occurrence?.id ?? 'no-event';
    members.forEach((member, index) => {
      applyToEntity(member, this.property, resolveValue(this.source, `${occurrenceId}:${member.id ?? String(index)}`, context));
    });
    this.stop();
  }
}
