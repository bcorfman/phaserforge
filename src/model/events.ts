import type { TargetRef } from './types';

export type RuntimeEventFamily = 'custom' | 'bounds' | 'collision' | 'trigger-zone' | 'visibility';
export type RuntimeEventPayloadValue = number | string | boolean | null;
export type RuntimeEventPayload = Record<string, RuntimeEventPayloadValue>;

export type BoundsBehavior = 'stop' | 'limit' | 'bounce' | 'wrap';
export type BoundsSide = 'left' | 'right' | 'top' | 'bottom';
export type BoundsEventOutcome = 'contact-entered' | 'contact-exited' | 'wrapped' | 'bounced' | 'clamped' | 'stopped';
export type BoundsAxisFilter = 'any' | 'x' | 'y';
export type BoundsSideFilter = 'any' | BoundsSide;
export type RuntimeEventPhase = 'edge' | 'outcome';

export interface RuntimeEventOccurrence {
  id: string;
  order: number;
}

export interface RuntimeEventEndpoint {
  targetKey?: string;
  target?: TargetRef;
  entityId?: string;
}

export interface RuntimeEventOwner {
  targetKey?: string;
  target?: TargetRef;
  eventBlockId?: string;
}

export interface RuntimeEventEnvelopeBase {
  family: RuntimeEventFamily;
  type: string;
  phase?: RuntimeEventPhase;
  source?: RuntimeEventEndpoint;
  instigator?: RuntimeEventEndpoint;
  owner?: RuntimeEventOwner;
  payload: RuntimeEventPayload;
  occurrence: RuntimeEventOccurrence;
}

export interface CustomRuntimeEventEnvelope extends RuntimeEventEnvelopeBase {
  family: 'custom';
  type: string;
}

export interface BoundsRuntimeEventEnvelope extends RuntimeEventEnvelopeBase {
  family: 'bounds';
  type: BoundsEventOutcome;
  phase: RuntimeEventPhase;
  details: {
    axis: 'x' | 'y';
    side: BoundsSide;
    priorPosition?: { x: number; y: number };
    position?: { x: number; y: number };
  };
}

export interface CollisionRuntimeEventEnvelope extends RuntimeEventEnvelopeBase {
  family: 'collision';
}

export interface TriggerZoneRuntimeEventEnvelope extends RuntimeEventEnvelopeBase {
  family: 'trigger-zone';
}

export interface VisibilityRuntimeEventEnvelope extends RuntimeEventEnvelopeBase {
  family: 'visibility';
}

export type RuntimeEventEnvelope =
  | CustomRuntimeEventEnvelope
  | BoundsRuntimeEventEnvelope
  | CollisionRuntimeEventEnvelope
  | TriggerZoneRuntimeEventEnvelope
  | VisibilityRuntimeEventEnvelope;

export interface BoundsEventDefinition {
  value: BoundsEventOutcome;
  label: string;
  phase: RuntimeEventPhase;
  description: string;
  compatibleBehaviors: BoundsBehavior[];
}

export const BOUNDS_EVENT_DEFINITIONS: readonly BoundsEventDefinition[] = [
  {
    value: 'contact-entered',
    label: 'Contact Entered',
    phase: 'edge',
    description: 'Source begins touching or crossing a configured boundary before the behavior consequence is reported.',
    compatibleBehaviors: ['stop', 'limit', 'bounce', 'wrap'],
  },
  {
    value: 'contact-exited',
    label: 'Contact Exited',
    phase: 'edge',
    description: 'Source leaves a tracked boundary contact, including the deterministic contact exit after wrap relocation.',
    compatibleBehaviors: ['stop', 'limit', 'bounce', 'wrap'],
  },
  {
    value: 'wrapped',
    label: 'Wrapped',
    phase: 'outcome',
    description: 'Wrap relocated the source to the opposite boundary.',
    compatibleBehaviors: ['wrap'],
  },
  {
    value: 'bounced',
    label: 'Bounced',
    phase: 'outcome',
    description: 'Bounce inverted source velocity on the affected axis.',
    compatibleBehaviors: ['bounce'],
  },
  {
    value: 'clamped',
    label: 'Clamped',
    phase: 'outcome',
    description: 'Clamp at Edge corrected source position and prevented outward movement.',
    compatibleBehaviors: ['limit'],
  },
  {
    value: 'stopped',
    label: 'Stopped',
    phase: 'outcome',
    description: 'Stop corrected source position, zeroed affected velocity, and completed the movement action.',
    compatibleBehaviors: ['stop'],
  },
] as const;

export const BOUNDS_EVENT_VALUES = BOUNDS_EVENT_DEFINITIONS.map((definition) => definition.value);
export const BOUNDS_AXIS_FILTER_VALUES: readonly BoundsAxisFilter[] = ['any', 'x', 'y'];
export const BOUNDS_SIDE_FILTER_VALUES: readonly BoundsSideFilter[] = ['any', 'left', 'right', 'bottom', 'top'];

export const BOUNDS_SIDE_LABELS: Record<BoundsSideFilter, string> = {
  any: 'Any',
  left: 'Left / Min X',
  right: 'Right / Max X',
  bottom: 'Bottom / Min Y',
  top: 'Top / Max Y',
};

export function isBoundsEventOutcome(value: string): value is BoundsEventOutcome {
  return (BOUNDS_EVENT_VALUES as readonly string[]).includes(value);
}

export function isBoundsAxisFilter(value: string): value is BoundsAxisFilter {
  return (BOUNDS_AXIS_FILTER_VALUES as readonly string[]).includes(value);
}

export function isBoundsSideFilter(value: string): value is BoundsSideFilter {
  return (BOUNDS_SIDE_FILTER_VALUES as readonly string[]).includes(value);
}

export function boundsEventDefinition(outcome: BoundsEventOutcome): BoundsEventDefinition {
  return BOUNDS_EVENT_DEFINITIONS.find((definition) => definition.value === outcome) ?? BOUNDS_EVENT_DEFINITIONS[0];
}

export function boundsOutcomeIsCompatible(outcome: BoundsEventOutcome, behavior: BoundsBehavior): boolean {
  return boundsEventDefinition(outcome).compatibleBehaviors.includes(behavior);
}

export function boundsEventDebugName(outcome: BoundsEventOutcome, axis?: BoundsAxisFilter, side?: BoundsSideFilter): string {
  return `bounds:${outcome}:${axis ?? 'any'}:${side ?? 'any'}`;
}
