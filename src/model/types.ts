export type Id = string;

export type TargetRef =
  | { type: 'entity'; entityId: Id }
  | { type: 'group'; groupId: Id };

export interface SceneSpec {
  id: Id;
  entities: Record<Id, EntitySpec>;
  groups: Record<Id, GroupSpec>;
  behaviors: Record<Id, BehaviorSpec>;
  actions: Record<Id, ActionSpec>;
  conditions: Record<Id, ConditionSpec>;
}

export interface EntitySpec {
  id: Id;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupSpec {
  id: Id;
  name?: string;
  members: Id[]; // entity ids
}

export interface BehaviorSpec {
  id: Id;
  name?: string;
  target: TargetRef;
  rootActionId: Id;
}

export type ActionSpec =
  | SequenceActionSpec
  | MoveUntilActionSpec
  | WaitActionSpec
  | CallActionSpec;

export interface SequenceActionSpec {
  id: Id;
  type: 'Sequence';
  children: Id[]; // action ids
}

export interface MoveUntilActionSpec {
  id: Id;
  type: 'MoveUntil';
  target: TargetRef;
  velocity: { x: number; y: number }; // units per second
  conditionId: Id;
}

export interface WaitActionSpec {
  id: Id;
  type: 'Wait';
  durationMs: number;
}

export interface CallActionSpec {
  id: Id;
  type: 'Call';
  callId: Id;
}

export type ConditionSpec = BoundsHitConditionSpec | ElapsedTimeConditionSpec;

export interface BoundsHitConditionSpec {
  id: Id;
  type: 'BoundsHit';
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  mode: 'any' | 'all';
}

export interface ElapsedTimeConditionSpec {
  id: Id;
  type: 'ElapsedTime';
  durationMs: number;
}
