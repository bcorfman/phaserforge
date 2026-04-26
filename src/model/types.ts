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
  /**
   * Attached actions/presets applied to entities or formations.
   * This is the primary authoring model moving forward.
   */
  attachments: Record<Id, AttachmentSpec>;
  /**
   * Legacy behavior/action graph authoring model (kept for backward-compatible
   * YAML migration only; new scenes should not rely on it).
   */
  behaviors: Record<Id, BehaviorSpec>;
  actions: Record<Id, ActionSpec>;
  conditions: Record<Id, ConditionSpec>;
}

export interface BackgroundLayerSpec {
  assetId: Id;
  x: number;
  y: number;
  depth: number;
  alpha?: number;
  tint?: number;
  scrollFactor?: { x: number; y: number };
  layout: 'stretch' | 'cover' | 'contain' | 'center' | 'tile';
}

export interface SceneMusicSpec {
  assetId: Id;
  loop: boolean;
  volume: number;
  fadeMs: number;
}

export interface SceneAmbienceSpec {
  assetId: Id;
  loop: boolean;
  volume: number;
}

export interface SceneInputSpec {
  activeMapId?: Id;
  fallbackMapId?: Id;
  mouse?: {
    hideOsCursorInPlay?: boolean;
    driveEntityId?: Id;
    affectX?: boolean;
    affectY?: boolean;
  };
}

export interface GameSceneSpec extends SceneSpec {
  backgroundLayers?: BackgroundLayerSpec[];
  music?: SceneMusicSpec;
  ambience?: SceneAmbienceSpec[];
  input?: SceneInputSpec;
}

export interface ImageAssetSpec {
  id: Id;
  source: SpriteAssetSource;
}

export interface SpriteSheetAssetSpec {
  id: Id;
  source: SpriteAssetSource;
  grid: SpriteSheetGridSpec;
}

export interface AudioAssetSpec {
  id: Id;
  source: SpriteAssetSource;
}

export interface InputActionMapSpec {
  actions: Record<string, Array<InputBindingSpec>>;
}

export type InputBindingSpec =
  | { device: 'keyboard'; key: string; event: 'down' | 'up' | 'held' }
  | { device: 'mouse'; button: 'left' | 'middle' | 'right'; event: 'down' | 'up' | 'held' }
  | { device: 'pointer'; event: 'move' | 'drag'; region?: string }
  | { device: 'gamepad'; control: string; event: 'down' | 'up' | 'axis'; threshold?: number };

export interface ProjectSpec {
  id: Id;
  assets: {
    images: Record<Id, ImageAssetSpec>;
    spriteSheets: Record<Id, SpriteSheetAssetSpec>;
  };
  audio: {
    sounds: Record<Id, AudioAssetSpec>;
  };
  inputMaps: Record<Id, InputActionMapSpec>;
  defaultInputMapId?: Id;
  scenes: Record<Id, GameSceneSpec>;
  initialSceneId: Id;
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
  | { type: 'arrange'; arrangeKind: string; params: Record<string, number | string | boolean> }
  | { type: 'freeform' };

export interface GroupSpec {
  id: Id;
  name?: string;
  members: Id[]; // entity ids
  layout?: GroupLayoutSpec;
}

export type InlineConditionSpec = InlineBoundsHitConditionSpec | InlineElapsedTimeConditionSpec;

export interface InlineBoundsHitConditionSpec {
  type: 'BoundsHit';
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  mode: 'any' | 'all';
  scope?: 'member-any' | 'member-all' | 'group-extents';
  behavior?: 'stop' | 'limit' | 'bounce' | 'wrap';
}

export interface InlineElapsedTimeConditionSpec {
  type: 'ElapsedTime';
  durationMs: number;
}

export interface AttachmentSpec {
  id: Id;
  name?: string;
  /**
   * Ordering key for the target's attachment list.
   * Lower numbers run earlier when compiling a script sequence.
   */
  order?: number;
  target: TargetRef;
  /**
   * Only meaningful when target.type === 'group'.
   * - group: action targets the formation as a synchronized unit
   * - members: action targets each member individually (compiled as Parallel)
   */
  applyTo?: 'group' | 'members';
  enabled?: boolean;
  /**
   * Identifier of the preset/action entry in the editor registry.
   * For v1, this will typically match an action `type` like "MoveUntil".
   */
  presetId: string;
  params?: Record<string, number | string | boolean | null>;
  condition?: InlineConditionSpec;
  tag?: string;
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
  args?: Record<string, number | string | boolean | null>;
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
    default?: number | string | boolean;
  }>;
}

export interface EditorRegistryConfig {
  arrange: EditorRegistryEntry[];
  actions: EditorRegistryEntry[];
  conditions: EditorRegistryEntry[];
}
