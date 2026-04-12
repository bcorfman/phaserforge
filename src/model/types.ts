export type Id = string;

export type StartupMode = 'reload_last_yaml' | 'new_empty_scene';

export type TargetRef =
  | { type: 'entity'; entityId: Id }
  | { type: 'group'; groupId: Id };

export interface SceneSpec {
  id: Id;
  world?: WorldSpec;
  entities: Record<Id, EntitySpec>;
  groups: Record<Id, GroupSpec>;
  behaviors: Record<Id, BehaviorSpec>;
  actions: Record<Id, ActionSpec>;
  conditions: Record<Id, ConditionSpec>;
}

export interface WorldSpec {
  width: number;
  height: number;
}

export interface EntitySpec {
  id: Id;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hitbox?: HitboxSpec;
  rotationDeg?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  visible?: boolean;
  depth?: number;
  flipX?: boolean;
  flipY?: boolean;
  asset?: SpriteAssetSpec;
}

export interface HitboxSpec {
  /**
   * Hitbox rectangle in unscaled, unrotated sprite-local pixel coordinates.
   * (0,0) is the sprite's top-left corner before origin/rotation.
   */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SpriteAssetSource =
  | {
      kind: 'embedded';
      dataUrl: string;
      originalName?: string;
      mimeType?: string;
    }
  | {
      kind: 'path';
      path: string;
    };

export interface SpriteSheetGridSpec {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

export interface SpriteFrameSpec {
  kind: 'single' | 'spritesheet-frame';
  frameIndex?: number;
  frameKey?: string;
  frameX?: number;
  frameY?: number;
}

export interface EntityPropertyTarget {
  key: 'x' | 'y' | 'rotationDeg' | 'scaleX' | 'scaleY' | 'alpha' | 'width' | 'height' | 'originX' | 'originY' | 'depth' | 'visible' | 'flipX' | 'flipY';
  type: 'number' | 'boolean' | 'enum';
  tweenable?: boolean;
  affectsBounds?: boolean;
}

export interface SpriteAssetSpec {
  source: SpriteAssetSource;
  imageType: 'image' | 'spritesheet';
  grid?: SpriteSheetGridSpec;
  frame?: SpriteFrameSpec;
}

export type GroupLayoutSpec =
  | { type: 'grid'; rows: number; cols: number; startX: number; startY: number; spacingX: number; spacingY: number }
  | { type: 'freeform' };

export interface GroupSpec {
  id: Id;
  name?: string;
  members: Id[]; // entity ids
  layout?: GroupLayoutSpec;
}

export interface BehaviorSpec {
  id: Id;
  name?: string;
  target: TargetRef;
  rootActionId?: Id;
}

export type ActionSpec =
  | SequenceActionSpec
  | MoveUntilActionSpec
  | WaitActionSpec
  | CallActionSpec
  | RepeatActionSpec;

export interface SequenceActionSpec {
  id: Id;
  type: 'Sequence';
  name?: string;
  children: Id[]; // action ids
}

export interface MoveUntilActionSpec {
  id: Id;
  type: 'MoveUntil';
  name?: string;
  target: TargetRef;
  velocity: { x: number; y: number }; // units per second
  conditionId: Id;
}

export interface WaitActionSpec {
  id: Id;
  type: 'Wait';
  name?: string;
  durationMs: number;
}

export interface CallActionSpec {
  id: Id;
  type: 'Call';
  name?: string;
  callId: Id;
  target?: TargetRef;
  args?: Record<string, number>;
}

export interface RepeatActionSpec {
  id: Id;
  type: 'Repeat';
  name?: string;
  childId: Id;
  count?: number; // undefined = infinite
}

export type ConditionSpec = BoundsHitConditionSpec | ElapsedTimeConditionSpec;

export interface BoundsHitConditionSpec {
  id: Id;
  type: 'BoundsHit';
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  mode: 'any' | 'all';
  scope?: 'member-any' | 'member-all' | 'group-extents';
  behavior?: 'stop' | 'limit' | 'bounce' | 'wrap';
}

export interface ElapsedTimeConditionSpec {
  id: Id;
  type: 'ElapsedTime';
  durationMs: number;
}

export interface EditorConfig {
  startupMode: StartupMode;
}

export interface EditorRegistryEntry {
  type: string;
  displayName: string;
  category: string;
  targetKinds?: Array<'entity' | 'group'>;
  implemented: boolean;
  propertyTargets?: EntityPropertyTarget[];
  parameters?: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean' | 'target' | 'reference';
    required?: boolean;
  }>;
}

export interface EditorRegistryConfig {
  arrange: EditorRegistryEntry[];
  actions: EditorRegistryEntry[];
  conditions: EditorRegistryEntry[];
}
