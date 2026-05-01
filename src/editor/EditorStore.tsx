import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  CollisionRuleSpec,
  EditorRegistryConfig,
  BackgroundLayerSpec,
  GroupSpec,
  Id,
  GameSceneSpec,
  ProjectSpec,
  SceneSpec,
  StartupMode,
  TriggerZoneSpec,
  type EntitySpec,
  type InputBindingSpec,
  type SpriteAssetSpec,
} from '../model/types';
import { createEmptyProject, createEmptyGameScene } from '../model/emptyProject';
import { validateSceneSpec } from '../model/validation';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { applyGroupArrangeLayout, applyGroupGridLayout, applyGroupGridLayoutPreserveMembers, inferGroupGridLayout, type GroupGridLayout } from './formationLayout';
import { addEntitiesToGroup, dissolveGroup, insertEntitiesIntoGroup, removeEntitiesFromGroups, removeEntityFromGroup, updateGroupLayoutPosition } from './groupCommands';
import { syncBoundsToWorldResize } from './worldBounds';
import { loadEditorConfig, loadEditorRegistry, coerceStartupMode, EMPTY_EDITOR_REGISTRY } from '../model/editorConfig';
import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { createGroupIdFromName, createGroupSpec, getNextFormationName } from './behaviorCommands';
import { removeSceneGraphItem } from './sceneGraphCommands';
import { createAttachment, moveAttachmentWithinTarget, removeAttachment, updateAttachment } from './attachmentCommands';
import type { AttachmentSpec, TargetRef } from '../model/types';
import { getSceneWorld } from './sceneWorld';
import { getAssetReferences } from './assetReferences';

export const PROJECT_STORAGE_KEY = 'phaseractions.projectYaml.v1';
export const SCENE_STORAGE_KEY_V1 = 'phaseractions.sceneYaml.v1';
export const SCENE_STORAGE_KEY = 'phaseractions.sceneYaml.v2';
export const STARTUP_MODE_STORAGE_KEY = 'phaseractions.startupMode.v1';
export const THEME_MODE_STORAGE_KEY = 'phaseractions.themeMode.v1';
export const UI_SCALE_STORAGE_KEY = 'phaseractions.uiScale.v1';
export const DEFAULT_UI_SCALE = 0.95;

export type ThemeMode = 'system' | 'light' | 'dark';
export type SidebarScope = 'scene' | 'project';

export function coerceThemeMode(raw: string | null | undefined): ThemeMode {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function coerceUiScale(raw: string | null | undefined, fallback: number): number {
  const parsed = raw == null ? NaN : Number(raw);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(0.75, Math.min(1.1, value));
}

export type Selection =
  | { kind: 'none' }
  | { kind: 'entity'; id: Id }
  | { kind: 'entities'; ids: Id[] }
  | { kind: 'group'; id: Id }
  | { kind: 'attachment'; id: Id }
  | { kind: 'trigger'; id: Id };

type HistoryScope = 'scene' | 'project';

type SceneHistoryEntry = {
  scope: 'scene';
  kind: 'command' | 'canvas-interaction';
  timestampMs: number;
  sceneId: Id;
  beforeScene: GameSceneSpec;
  afterScene: GameSceneSpec;
  beforeDirty: boolean;
  afterDirty: boolean;
};

type ProjectHistoryEntry = {
  scope: 'project';
  kind: 'command';
  timestampMs: number;
  beforeProject: ProjectSpec;
  afterProject: ProjectSpec;
  beforeCurrentSceneId: Id;
  afterCurrentSceneId: Id;
  beforeDirty: boolean;
  afterDirty: boolean;
};

export type HistoryEntry = (SceneHistoryEntry | ProjectHistoryEntry) & {
  beforeSelection: Selection;
  afterSelection: Selection;
  beforeExpandedGroups?: Record<Id, boolean>;
  afterExpandedGroups?: Record<Id, boolean>;
  mergeKey?: string;
};

type PendingHistory = {
  scope: 'scene';
  kind: 'canvas-interaction';
  sceneId: Id;
  beforeScene: GameSceneSpec;
  beforeSelection: Selection;
  beforeExpandedGroups: Record<Id, boolean>;
  beforeDirty: boolean;
  changed: boolean;
};

type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  pending?: PendingHistory;
};

export interface EditorState {
  project: ProjectSpec;
  currentSceneId: Id;
  selection: Selection;
  sidebarScope: SidebarScope;
  expandedGroups: Record<Id, boolean>;
  history: HistoryState;
  dirty: boolean;
  yamlText: string;
  error?: string;
  statusMessage?: string;
  statusExpiresAt?: number;
  interaction?: { kind: 'entity' | 'entities' | 'group' | 'bounds'; id: string; handle?: 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' };
  mode: 'edit' | 'play';
  hasSeenViewHint: boolean;
  startupMode: StartupMode;
  themeMode: ThemeMode;
  uiScale: number;
  registry: EditorRegistryConfig;
  initialized: boolean;
  pendingGroupRestore?: { group: GroupSpec; attachments: Record<Id, AttachmentSpec> };
}

export type ImportedEntityDraft = {
  entity: EntitySpec;
  addToSelectedGroup?: boolean;
};

export type EditorAction =
  | { type: 'initialize'; project: ProjectSpec; currentSceneId: Id; startupMode: StartupMode; themeMode: ThemeMode; uiScale: number; registry: EditorRegistryConfig }
  | { type: 'set-startup-mode'; startupMode: StartupMode }
  | { type: 'set-theme-mode'; themeMode: ThemeMode }
  | { type: 'set-ui-scale'; uiScale: number }
  | { type: 'set-sidebar-scope'; scope: SidebarScope }
  | { type: 'select'; selection: Selection }
  | { type: 'select-multiple'; entityIds: Id[]; additive: boolean }
  | { type: 'delete-selection' }
  | { type: 'history-undo' }
  | { type: 'history-redo' }
  | { type: 'set-yaml-text'; value: string }
  | { type: 'set-error'; error?: string }
  | { type: 'set-status'; message?: string; expiresAt?: number }
  | { type: 'export-yaml' }
  | { type: 'load-yaml' }
  | { type: 'load-yaml-text'; text: string; sourceLabel: string }
  | { type: 'reset-scene' }
  | { type: 'set-current-scene'; sceneId: Id }
  | { type: 'create-scene'; sceneId?: Id }
  | { type: 'duplicate-scene'; sceneId: Id; nextSceneId?: Id }
  | { type: 'delete-scene'; sceneId: Id }
  | { type: 'rename-scene'; sceneId: Id; name: string }
  | { type: 'toggle-base-scene'; sceneId: Id }
  | { type: 'update-scene-world'; width: number; height: number }
  | { type: 'update-entity'; id: Id; next: EntitySpec }
  | { type: 'import-entities'; drafts: ImportedEntityDraft[] }
  | { type: 'update-group'; id: Id; next: GroupSpec }
  | { type: 'create-attachment'; target: TargetRef; presetId: string }
  | { type: 'update-attachment'; id: Id; next: AttachmentSpec }
  | { type: 'remove-attachment'; id: Id }
  | { type: 'move-attachment'; id: Id; direction: 'up' | 'down' }
  | { type: 'toggle-group-expanded'; id: Id }
  | { type: 'move-entity'; id: Id; dx: number; dy: number }
  | { type: 'move-group'; id: Id; dx: number; dy: number }
  | { type: 'move-entities'; entityIds: Id[]; dx: number; dy: number }
  | { type: 'duplicate-entities'; entityIds: Id[] }
  | { type: 'set-entities-asset'; entityIds: Id[]; asset?: SpriteAssetSpec }
  | { type: 'arrange-group-grid'; id: Id; layout: GroupGridLayout }
  | { type: 'arrange-group'; id: Id; arrangeKind: string; params: Record<string, number | string | boolean> }
  | { type: 'create-group-from-arrange'; name: string; templateEntityId: Id; arrangeKind: string; params: Record<string, number | string | boolean>; memberCount?: number }
  | { type: 'update-bounds'; id: Id; bounds: { minX: number; maxX: number; minY: number; maxY: number } }
  | { type: 'begin-canvas-interaction'; kind: 'entity' | 'entities' | 'group' | 'bounds'; id: string; handle?: string }
  | { type: 'end-canvas-interaction' }
  | { type: 'create-group-from-selection'; name: string }
  | { type: 'ungroup-group'; id: Id }
  | { type: 'group-selection'; name: string }
  | { type: 'delete-group'; id: Id }
  | { type: 'add-entities-to-group'; groupId: Id; entityIds: Id[] }
  | { type: 'insert-entities-into-group'; groupId: Id; entityIds: Id[]; index: number }
  | { type: 'remove-entities-from-groups'; entityIds: Id[] }
  | { type: 'remove-entity-from-group'; groupId: Id; entityId: Id }
  | { type: 'dissolve-group'; id: Id }
  | { type: 'convert-group-layout-freeform'; id: Id }
  | { type: 'convert-group-layout-grid'; id: Id; rows: number; cols: number }
  | { type: 'convert-group-layout-arrange'; id: Id; arrangeKind: string }
  | { type: 'remove-scene-graph-item'; item: { kind: 'entity' | 'group' | 'attachment'; id: Id } }
  | { type: 'add-background-layer-from-file'; file: { dataUrl: string; originalName?: string; mimeType?: string }; defaults?: { layout?: BackgroundLayerSpec['layout'] } }
  | { type: 'add-image-asset-from-file'; file: { dataUrl: string; originalName?: string; mimeType?: string } }
  | { type: 'add-image-asset-from-path'; path: string; suggestedId?: string }
  | { type: 'add-spritesheet-asset-from-file'; file: { dataUrl: string; originalName?: string; mimeType?: string }; grid: { frameWidth: number; frameHeight: number; columns: number; rows: number } }
  | { type: 'add-spritesheet-asset-from-path'; path: string; suggestedId?: string; grid: { frameWidth: number; frameHeight: number; columns: number; rows: number } }
  | { type: 'add-font-asset-from-file'; file: { dataUrl: string; originalName?: string; mimeType?: string } }
  | { type: 'add-font-asset-from-path'; path: string; suggestedId?: string }
  | { type: 'set-asset-display-name'; assetKind: 'image' | 'spritesheet' | 'audio' | 'font'; assetId: Id; name?: string }
  | { type: 'remove-asset'; assetKind: 'image' | 'spritesheet' | 'audio' | 'font'; assetId: Id }
  | { type: 'create-entity-from-asset'; assetKind: 'image' | 'spritesheet'; assetId: Id; at?: { x: number; y: number } }
  | {
      type: 'assign-asset-to-target';
      assetKind: 'image' | 'spritesheet' | 'audio';
      assetId: Id;
      target:
        | { kind: 'background-layer'; sceneId: Id; layerIndex?: number }
        | { kind: 'scene-music'; sceneId: Id }
        | { kind: 'scene-ambience'; sceneId: Id; index?: number }
        | { kind: 'entity-sprite'; sceneId: Id; entityId: Id };
    }
  | { type: 'add-audio-asset-from-file'; file: { dataUrl: string; originalName?: string; mimeType?: string } }
  | { type: 'add-audio-asset-from-path'; path: string; suggestedId?: string }
  | { type: 'remove-audio-asset'; assetId: Id }
  | { type: 'set-scene-music'; music: GameSceneSpec['music'] | undefined }
  | { type: 'set-scene-ambience'; ambience: NonNullable<GameSceneSpec['ambience']> }
  | { type: 'create-input-map'; mapId?: Id }
  | { type: 'duplicate-input-map'; sourceMapId: Id; nextMapId?: Id }
  | { type: 'remove-input-map'; mapId: Id }
  | { type: 'add-input-binding'; mapId: Id; actionId: string; binding: InputBindingSpec }
  | { type: 'remove-input-binding'; mapId: Id; actionId: string; index: number }
  | { type: 'set-project-default-input-map'; mapId?: Id }
  | { type: 'set-scene-input'; input: GameSceneSpec['input'] | undefined }
  | { type: 'set-scene-background-layers'; layers: BackgroundLayerSpec[] }
  | { type: 'update-background-layer'; index: number; patch: Partial<BackgroundLayerSpec> }
  | { type: 'move-background-layer'; fromIndex: number; toIndex: number }
  | { type: 'remove-background-layer'; index: number }
  | { type: 'add-collision-rule' }
  | { type: 'update-collision-rule'; id: Id; patch: Partial<CollisionRuleSpec> }
  | { type: 'remove-collision-rule'; id: Id }
  | { type: 'add-trigger-zone' }
  | { type: 'update-trigger-zone'; id: Id; patch: Partial<TriggerZoneSpec> }
  | { type: 'remove-trigger-zone'; id: Id }
  | { type: 'toggle-mode' }
  | { type: 'dismiss-view-hint' };

function defaultExpandedGroups(scene: SceneSpec): Record<Id, boolean> {
  return Object.fromEntries(Object.keys(scene.groups).map((groupId) => [groupId, false]));
}

function syncExpandedGroupsToScene(expandedGroups: Record<Id, boolean>, scene: SceneSpec): Record<Id, boolean> {
  const next: Record<Id, boolean> = {};
  for (const groupId of Object.keys(scene.groups)) {
    next[groupId] = expandedGroups[groupId] ?? false;
  }
  return next;
}

function idsEqualAsSet(a: Id[], b: Id[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const id of b) {
    if (!setA.has(id)) return false;
  }
  return true;
}

function allocUniqueId(existing: Record<string, unknown>, base: string): string {
  const sanitizedBase = base.trim().length > 0 ? base.trim() : 'scene';
  if (!existing[sanitizedBase]) return sanitizedBase;
  let counter = 2;
  while (existing[`${sanitizedBase}-${counter}`]) counter += 1;
  return `${sanitizedBase}-${counter}`;
}

function assetIdBaseFromOriginalName(name: string | undefined, fallbackBase: string = 'background'): string {
  const raw = (name ?? '').trim();
  const withoutExt = raw.replace(/\.[a-z0-9]+$/i, '');
  const base = withoutExt.length > 0 ? withoutExt : fallbackBase;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'background';
}

function removeGroupKeepMembers(
  scene: SceneSpec,
  groupId: Id
): { scene: SceneSpec; removed?: { group: GroupSpec; attachments: Record<Id, AttachmentSpec> } } {
  const group = scene.groups[groupId];
  if (!group) return { scene };

  const removedAttachments: Record<Id, AttachmentSpec> = {};
  const remainingAttachments: Record<Id, AttachmentSpec> = {};
  for (const [id, attachment] of Object.entries(scene.attachments)) {
    if (attachment.target.type === 'group' && attachment.target.groupId === groupId) {
      removedAttachments[id] = attachment;
    } else {
      remainingAttachments[id] = attachment;
    }
  }

  const { [groupId]: _removedGroup, ...remainingGroups } = scene.groups;
  void _removedGroup;

  return {
    scene: { ...scene, groups: remainingGroups, attachments: remainingAttachments },
    removed: { group, attachments: removedAttachments },
  };
}

const EditorContext = createContext<{
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
} | null>(null);

function defaultState(): EditorState {
  const project = createEmptyProject();
  const currentSceneId = project.initialSceneId;
  const scene = project.scenes[currentSceneId];
  return {
    project,
    currentSceneId,
    selection: { kind: 'none' },
    sidebarScope: 'scene',
    expandedGroups: defaultExpandedGroups(scene),
    history: { past: [], future: [], pending: undefined },
    dirty: false,
    yamlText: '',
    mode: 'edit',
    hasSeenViewHint: false,
    startupMode: 'reload_last_yaml',
    themeMode: 'system',
    uiScale: DEFAULT_UI_SCALE,
    registry: EMPTY_EDITOR_REGISTRY,
    initialized: false,
    pendingGroupRestore: undefined,
  };
}

export function initState(): EditorState {
  return defaultState();
}

export function getActiveScene(state: Pick<EditorState, 'project' | 'currentSceneId'>): GameSceneSpec {
  const scene = state.project.scenes[state.currentSceneId];
  if (!scene) {
    throw new Error(`Missing active scene ${state.currentSceneId}`);
  }
  return scene;
}

function withScene(
  state: EditorState,
  scene: GameSceneSpec,
  dirty: boolean,
  selection: Selection = state.selection,
  expandedGroups: Record<Id, boolean> = state.expandedGroups
): EditorState {
  return {
    ...state,
    project: {
      ...state.project,
      scenes: {
        ...state.project.scenes,
        [state.currentSceneId]: scene,
      },
    },
    selection,
    expandedGroups,
    dirty,
    error: undefined,
  };
}

function withBaseSceneId(project: ProjectSpec, baseSceneId: Id | undefined): ProjectSpec {
  const { baseSceneId: _removed, ...rest } = project as any as ProjectSpec & { baseSceneId?: Id };
  void _removed;
  return {
    ...rest,
    ...(baseSceneId ? { baseSceneId } : {}),
  };
}

function withSceneMeta(project: ProjectSpec, sceneMeta: ProjectSpec['sceneMeta'] | undefined): ProjectSpec {
  const { sceneMeta: _removed, ...rest } = project as any as ProjectSpec & { sceneMeta?: ProjectSpec['sceneMeta'] };
  void _removed;
  return {
    ...rest,
    ...(sceneMeta ? { sceneMeta } : {}),
  };
}

function importEntities(state: EditorState, drafts: ImportedEntityDraft[]): EditorState {
  if (drafts.length === 0) return state;
  const scene = getActiveScene(state);
  const entities = { ...scene.entities };
  const groups = { ...scene.groups };
  const importedIds: string[] = [];
  const addToGroupId = state.selection.kind === 'group' ? state.selection.id : undefined;

  for (const draft of drafts) {
    entities[draft.entity.id] = draft.entity;
    importedIds.push(draft.entity.id);
    if (draft.addToSelectedGroup && addToGroupId && groups[addToGroupId]) {
      groups[addToGroupId] = {
        ...groups[addToGroupId],
        members: [...groups[addToGroupId].members, draft.entity.id],
      };
    }
  }

  return {
    ...withScene(state, { ...scene, entities, groups }, true),
    selection: importedIds.length === 1 ? { kind: 'entity', id: importedIds[0] } : { kind: 'entities', ids: importedIds },
  };
}

const MAX_HISTORY = 100;
const MERGE_WINDOW_MS = 500;

function isUndoableAction(action: EditorAction): boolean {
  switch (action.type) {
    case 'update-entity':
    case 'import-entities':
    case 'update-group':
    case 'create-attachment':
    case 'update-attachment':
    case 'remove-attachment':
    case 'move-attachment':
    case 'move-entity':
    case 'move-group':
    case 'move-entities':
    case 'duplicate-entities':
    case 'arrange-group-grid':
    case 'arrange-group':
    case 'create-group-from-arrange':
    case 'update-bounds':
    case 'create-group-from-selection':
    case 'ungroup-group':
    case 'group-selection':
    case 'delete-group':
    case 'add-entities-to-group':
    case 'insert-entities-into-group':
    case 'remove-entities-from-groups':
    case 'remove-entity-from-group':
    case 'dissolve-group':
    case 'convert-group-layout-freeform':
    case 'convert-group-layout-grid':
    case 'convert-group-layout-arrange':
    case 'remove-scene-graph-item':
    case 'delete-selection':
    case 'update-scene-world':
    case 'create-scene':
    case 'duplicate-scene':
    case 'delete-scene':
    case 'rename-scene':
    case 'toggle-base-scene':
    case 'reset-scene':
    case 'load-yaml':
    case 'load-yaml-text':
    case 'add-background-layer-from-file':
    case 'add-image-asset-from-file':
    case 'add-image-asset-from-path':
    case 'add-spritesheet-asset-from-file':
    case 'add-spritesheet-asset-from-path':
    case 'add-font-asset-from-file':
    case 'add-font-asset-from-path':
    case 'set-asset-display-name':
    case 'remove-asset':
    case 'create-entity-from-asset':
    case 'assign-asset-to-target':
    case 'add-audio-asset-from-file':
    case 'add-audio-asset-from-path':
    case 'remove-audio-asset':
    case 'set-scene-music':
    case 'set-scene-ambience':
    case 'create-input-map':
    case 'duplicate-input-map':
    case 'remove-input-map':
    case 'add-input-binding':
    case 'remove-input-binding':
    case 'set-project-default-input-map':
    case 'set-scene-input':
    case 'set-scene-background-layers':
    case 'update-background-layer':
    case 'move-background-layer':
    case 'remove-background-layer':
      return true;
    default:
      return false;
  }
}

function getHistoryScope(action: EditorAction): HistoryScope {
  switch (action.type) {
    case 'create-scene':
    case 'duplicate-scene':
    case 'delete-scene':
    case 'rename-scene':
    case 'toggle-base-scene':
    case 'load-yaml':
    case 'load-yaml-text':
    case 'reset-scene':
    case 'add-background-layer-from-file':
    case 'add-image-asset-from-file':
    case 'add-image-asset-from-path':
    case 'add-spritesheet-asset-from-file':
    case 'add-spritesheet-asset-from-path':
    case 'add-font-asset-from-file':
    case 'add-font-asset-from-path':
    case 'set-asset-display-name':
    case 'remove-asset':
    case 'add-audio-asset-from-file':
    case 'add-audio-asset-from-path':
    case 'remove-audio-asset':
    case 'create-input-map':
    case 'duplicate-input-map':
    case 'remove-input-map':
    case 'add-input-binding':
    case 'remove-input-binding':
    case 'set-project-default-input-map':
      return 'project';
    default:
      return 'scene';
  }
}

function isPendingInteractionMutation(action: EditorAction): boolean {
  return action.type === 'move-entity'
    || action.type === 'move-group'
    || action.type === 'move-entities'
    || action.type === 'update-bounds'
    || action.type === 'duplicate-entities';
}

function groupIdSet(scene: SceneSpec): string {
  return Object.keys(scene.groups).sort().join('|');
}

function shouldCaptureExpandedGroupsForEntry(scope: HistoryScope, beforeScene: SceneSpec, afterScene: SceneSpec): boolean {
  if (scope === 'project') return true;
  return groupIdSet(beforeScene) !== groupIdSet(afterScene);
}

function mergeKeyForAction(action: EditorAction): string | undefined {
  switch (action.type) {
    case 'move-entity':
      return `entity:${action.id}`;
    case 'move-group':
      return `group:${action.id}`;
    case 'move-entities':
      return `entities:${[...action.entityIds].sort().join(',')}`;
    default:
      return undefined;
  }
}

function canMergeNudgeAction(action: EditorAction): boolean {
  return action.type === 'move-entity' || action.type === 'move-group' || action.type === 'move-entities';
}

function pushHistoryPast(past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...past, entry];
  if (next.length <= MAX_HISTORY) return next;
  return next.slice(next.length - MAX_HISTORY);
}

function applyUndo(state: EditorState): EditorState {
  const entry = state.history.past[state.history.past.length - 1];
  if (!entry) return state;

  const nextPast = state.history.past.slice(0, -1);
  const nextFuture = [entry, ...state.history.future];

  if (entry.scope === 'project') {
    const scene = entry.beforeProject.scenes[entry.beforeCurrentSceneId];
    return {
      ...state,
      project: entry.beforeProject,
      currentSceneId: entry.beforeCurrentSceneId,
      selection: entry.beforeSelection,
      expandedGroups: entry.beforeExpandedGroups ?? defaultExpandedGroups(scene),
      dirty: entry.beforeDirty,
      error: undefined,
      history: { past: nextPast, future: nextFuture, pending: undefined },
    };
  }

  const beforeScene = entry.beforeScene;
  const baseExpandedGroups = entry.sceneId === state.currentSceneId ? state.expandedGroups : defaultExpandedGroups(beforeScene);
  const nextExpandedGroups = entry.beforeExpandedGroups
    ? syncExpandedGroupsToScene(entry.beforeExpandedGroups, beforeScene)
    : syncExpandedGroupsToScene(baseExpandedGroups, beforeScene);

  return {
    ...state,
    project: {
      ...state.project,
      scenes: {
        ...state.project.scenes,
        [entry.sceneId]: beforeScene,
      },
    },
    currentSceneId: entry.sceneId,
    selection: entry.beforeSelection,
    expandedGroups: nextExpandedGroups,
    dirty: entry.beforeDirty,
    error: undefined,
    history: { past: nextPast, future: nextFuture, pending: undefined },
  };
}

function applyRedo(state: EditorState): EditorState {
  const entry = state.history.future[0];
  if (!entry) return state;

  const nextFuture = state.history.future.slice(1);
  const nextPast = pushHistoryPast(state.history.past, entry);

  if (entry.scope === 'project') {
    const scene = entry.afterProject.scenes[entry.afterCurrentSceneId];
    return {
      ...state,
      project: entry.afterProject,
      currentSceneId: entry.afterCurrentSceneId,
      selection: entry.afterSelection,
      expandedGroups: entry.afterExpandedGroups ?? defaultExpandedGroups(scene),
      dirty: entry.afterDirty,
      error: undefined,
      history: { past: nextPast, future: nextFuture, pending: undefined },
    };
  }

  const afterScene = entry.afterScene;
  const baseExpandedGroups = entry.sceneId === state.currentSceneId ? state.expandedGroups : defaultExpandedGroups(afterScene);
  const nextExpandedGroups = entry.afterExpandedGroups
    ? syncExpandedGroupsToScene(entry.afterExpandedGroups, afterScene)
    : syncExpandedGroupsToScene(baseExpandedGroups, afterScene);

  return {
    ...state,
    project: {
      ...state.project,
      scenes: {
        ...state.project.scenes,
        [entry.sceneId]: afterScene,
      },
    },
    currentSceneId: entry.sceneId,
    selection: entry.afterSelection,
    expandedGroups: nextExpandedGroups,
    dirty: entry.afterDirty,
    error: undefined,
    history: { past: nextPast, future: nextFuture, pending: undefined },
  };
}

function recordHistoryForAction(stateBefore: EditorState, stateAfter: EditorState, action: EditorAction): EditorState {
  if (!isUndoableAction(action)) return stateAfter;
  const scope = getHistoryScope(action);
  const timestampMs = Date.now();

  if (scope === 'project') {
    const changed = stateBefore.project !== stateAfter.project
      || stateBefore.currentSceneId !== stateAfter.currentSceneId
      || stateBefore.dirty !== stateAfter.dirty;
    if (!changed) return stateAfter;

    const beforeScene = stateBefore.project.scenes[stateBefore.currentSceneId];
    const afterScene = stateAfter.project.scenes[stateAfter.currentSceneId];
    const captureExpanded = beforeScene && afterScene
      ? shouldCaptureExpandedGroupsForEntry(scope, beforeScene, afterScene)
      : true;

    const entry: HistoryEntry = {
      scope: 'project',
      kind: 'command',
      timestampMs,
      beforeProject: stateBefore.project,
      afterProject: stateAfter.project,
      beforeCurrentSceneId: stateBefore.currentSceneId,
      afterCurrentSceneId: stateAfter.currentSceneId,
      beforeDirty: stateBefore.dirty,
      afterDirty: stateAfter.dirty,
      beforeSelection: stateBefore.selection,
      afterSelection: stateAfter.selection,
      beforeExpandedGroups: captureExpanded ? stateBefore.expandedGroups : undefined,
      afterExpandedGroups: captureExpanded ? stateAfter.expandedGroups : undefined,
    };

    return {
      ...stateAfter,
      history: {
        past: pushHistoryPast(stateBefore.history.past, entry),
        future: [],
        pending: stateAfter.history.pending,
      },
    };
  }

  const sceneId = stateBefore.currentSceneId;
  const beforeScene = stateBefore.project.scenes[sceneId];
  const afterScene = stateAfter.project.scenes[sceneId];
  const changed = beforeScene !== afterScene || stateBefore.dirty !== stateAfter.dirty;
  if (!changed) return stateAfter;

  const captureExpanded = beforeScene && afterScene
    ? shouldCaptureExpandedGroupsForEntry(scope, beforeScene, afterScene)
    : false;

  const mergeKey = mergeKeyForAction(action);
  const shouldTryMerge = canMergeNudgeAction(action) && mergeKey && !stateBefore.history.pending;
  if (shouldTryMerge) {
    const last = stateBefore.history.past[stateBefore.history.past.length - 1];
    if (last && last.scope === 'scene' && last.kind === 'command' && last.sceneId === sceneId && last.mergeKey === mergeKey) {
      const withinWindow = timestampMs - last.timestampMs <= MERGE_WINDOW_MS;
      if (withinWindow) {
        const merged: HistoryEntry = {
          ...last,
          timestampMs,
          afterScene,
          afterSelection: stateAfter.selection,
          afterDirty: stateAfter.dirty,
        };
        return {
          ...stateAfter,
          history: {
            past: [...stateBefore.history.past.slice(0, -1), merged],
            future: [],
            pending: stateAfter.history.pending,
          },
        };
      }
    }
  }

  const entry: HistoryEntry = {
    scope: 'scene',
    kind: 'command',
    timestampMs,
    sceneId,
    beforeScene,
    afterScene,
    beforeDirty: stateBefore.dirty,
    afterDirty: stateAfter.dirty,
    beforeSelection: stateBefore.selection,
    afterSelection: stateAfter.selection,
    beforeExpandedGroups: captureExpanded ? stateBefore.expandedGroups : undefined,
    afterExpandedGroups: captureExpanded ? stateAfter.expandedGroups : undefined,
    mergeKey,
  };

  return {
    ...stateAfter,
    history: {
      past: pushHistoryPast(stateBefore.history.past, entry),
      future: [],
      pending: stateAfter.history.pending,
    },
  };
}

function applyAction(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'initialize':
      return (() => {
        const currentSceneId = action.project.scenes[action.currentSceneId]
          ? action.currentSceneId
          : action.project.initialSceneId;
        const activeScene = action.project.scenes[currentSceneId];
        validateSceneSpec(activeScene);
        return {
          ...state,
          project: action.project,
          currentSceneId,
          selection: { kind: 'none' },
          sidebarScope: state.sidebarScope ?? 'scene',
          expandedGroups: defaultExpandedGroups(activeScene),
          history: { past: [], future: [], pending: undefined },
          dirty: false,
          error: undefined,
          statusMessage: undefined,
          statusExpiresAt: undefined,
          startupMode: action.startupMode,
          themeMode: action.themeMode,
          uiScale: coerceUiScale(String(action.uiScale), DEFAULT_UI_SCALE),
          registry: action.registry,
          initialized: true,
        };
      })();
    case 'set-startup-mode':
      return {
        ...state,
        startupMode: action.startupMode,
      };
    case 'set-theme-mode':
      return {
        ...state,
        themeMode: action.themeMode,
      };
    case 'set-ui-scale':
      return {
        ...state,
        uiScale: coerceUiScale(String(action.uiScale), state.uiScale),
      };
    case 'set-sidebar-scope':
      return {
        ...state,
        sidebarScope: action.scope,
      };
    case 'select':
      return { ...state, selection: action.selection, error: undefined };
    case 'set-yaml-text':
      return { ...state, yamlText: action.value };
    case 'set-error':
      return { ...state, error: action.error };
    case 'set-status':
      return { ...state, statusMessage: action.message, statusExpiresAt: action.expiresAt };
    case 'export-yaml':
      return { ...state, yamlText: serializeProjectToYaml(state.project), error: undefined };
    case 'load-yaml': {
      try {
        const parsed = parseProjectYaml(state.yamlText);
        for (const scene of Object.values(parsed.scenes)) validateSceneSpec(scene);
        const currentSceneId = parsed.initialSceneId;
        return {
          ...state,
          project: parsed,
          currentSceneId,
          expandedGroups: defaultExpandedGroups(parsed.scenes[currentSceneId]),
          dirty: false,
          error: undefined,
          selection: { kind: 'none' },
        };
      } catch (err) {
        return {
          ...state,
          error: err instanceof Error ? err.message : 'Invalid YAML',
          statusMessage: undefined,
          statusExpiresAt: undefined,
        };
      }
    }
    case 'load-yaml-text': {
      try {
        const parsed = parseProjectYaml(action.text);
        for (const scene of Object.values(parsed.scenes)) validateSceneSpec(scene);
        const currentSceneId = parsed.initialSceneId;
        const expiresAt = Date.now() + 4000;
        return {
          ...state,
          project: parsed,
          currentSceneId,
          expandedGroups: defaultExpandedGroups(parsed.scenes[currentSceneId]),
          dirty: false,
          error: undefined,
          selection: { kind: 'none' },
          yamlText: action.text,
          statusMessage: `Loaded YAML: ${action.sourceLabel}`,
          statusExpiresAt: expiresAt,
        };
      } catch (err) {
        return {
          ...state,
          error: err instanceof Error ? err.message : 'Invalid YAML',
          statusMessage: undefined,
          statusExpiresAt: undefined,
        };
      }
    }
    case 'reset-scene':
      return (() => {
        const nextScene = createEmptyGameScene(state.currentSceneId);
        return withScene(
          {
            ...state,
            selection: { kind: 'none' },
          },
          nextScene,
          false,
          { kind: 'none' },
          defaultExpandedGroups(nextScene),
        );
      })();
    case 'set-current-scene': {
      if (!state.project.scenes[action.sceneId]) return state;
      const nextScene = state.project.scenes[action.sceneId];
      return {
        ...state,
        currentSceneId: action.sceneId,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(nextScene),
        error: undefined,
      };
    }
    case 'create-scene': {
      const nextId = allocUniqueId(state.project.scenes, action.sceneId ?? 'scene-1');
      const nextScene = createEmptyGameScene(nextId);
      const project: ProjectSpec = {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [nextId]: nextScene,
        },
      };
      return {
        ...state,
        project,
        currentSceneId: nextId,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(nextScene),
        dirty: true,
        error: undefined,
      };
    }
    case 'duplicate-scene': {
      const source = state.project.scenes[action.sceneId];
      if (!source) return state;
      const nextId = allocUniqueId(state.project.scenes, action.nextSceneId ?? `${action.sceneId}-copy`);
      const cloned = JSON.parse(JSON.stringify(source)) as GameSceneSpec;
      cloned.id = nextId;
      const sourceMeta = state.project.sceneMeta?.[action.sceneId];
      const nextSceneMeta = sourceMeta
        ? { ...(state.project.sceneMeta ?? {}), [nextId]: JSON.parse(JSON.stringify(sourceMeta)) }
        : state.project.sceneMeta;

      let project: ProjectSpec = {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [nextId]: cloned,
        },
      };
      project = withSceneMeta(project, nextSceneMeta);
      return {
        ...state,
        project,
        currentSceneId: nextId,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(cloned),
        dirty: true,
        error: undefined,
      };
    }
    case 'delete-scene': {
      const keys = Object.keys(state.project.scenes);
      if (keys.length <= 1) return state;
      if (!state.project.scenes[action.sceneId]) return state;
      const { [action.sceneId]: _removed, ...remaining } = state.project.scenes;
      void _removed;
      const remainingIds = Object.keys(remaining);
      const fallbackId = remainingIds[0];
      const nextCurrent = state.currentSceneId === action.sceneId ? fallbackId : state.currentSceneId;
      const nextInitial = state.project.initialSceneId === action.sceneId ? fallbackId : state.project.initialSceneId;
      const nextBaseSceneId = state.project.baseSceneId === action.sceneId ? undefined : state.project.baseSceneId;
      const nextSceneMeta = state.project.sceneMeta
        ? Object.fromEntries(Object.entries(state.project.sceneMeta).filter(([sceneId]) => sceneId !== action.sceneId))
        : undefined;

      let project: ProjectSpec = {
        ...state.project,
        scenes: remaining,
        initialSceneId: nextInitial,
      };
      project = withBaseSceneId(project, nextBaseSceneId);
      project = withSceneMeta(project, nextSceneMeta);
      const activeScene = project.scenes[nextCurrent];
      return {
        ...state,
        project,
        currentSceneId: nextCurrent,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(activeScene),
        dirty: true,
        error: undefined,
      };
    }
    case 'rename-scene': {
      const source = state.project.scenes[action.sceneId];
      if (!source) return state;
      const desired = action.name.trim();
      if (desired.length === 0) return state;
      const nextId = desired === action.sceneId ? desired : allocUniqueId(state.project.scenes, desired);
      if (nextId === action.sceneId) return state;

      const { [action.sceneId]: _removed, ...rest } = state.project.scenes;
      void _removed;
      const renamed: GameSceneSpec = { ...(source as any), id: nextId };
      const scenes = { ...rest, [nextId]: renamed };
      const nextBaseSceneId = state.project.baseSceneId === action.sceneId ? nextId : state.project.baseSceneId;
      const nextSceneMeta = state.project.sceneMeta
        ? (() => {
          const { [action.sceneId]: removed, ...kept } = state.project.sceneMeta!;
          return removed ? { ...kept, [nextId]: removed } : kept;
        })()
        : undefined;

      let project: ProjectSpec = {
        ...state.project,
        scenes,
        initialSceneId: state.project.initialSceneId === action.sceneId ? nextId : state.project.initialSceneId,
      };
      project = withBaseSceneId(project, nextBaseSceneId);
      project = withSceneMeta(project, nextSceneMeta);
      return {
        ...state,
        project,
        currentSceneId: state.currentSceneId === action.sceneId ? nextId : state.currentSceneId,
        selection: { kind: 'none' },
        expandedGroups: state.currentSceneId === action.sceneId ? defaultExpandedGroups(renamed) : state.expandedGroups,
        dirty: true,
        error: undefined,
      };
    }
    case 'toggle-base-scene': {
      if (!state.project.scenes[action.sceneId]) return state;
      const nextBaseSceneId = state.project.baseSceneId === action.sceneId ? undefined : action.sceneId;
      const project = withBaseSceneId(state.project, nextBaseSceneId);
      return {
        ...state,
        project,
        dirty: true,
        error: undefined,
      };
    }
    case 'update-scene-world':
      return (() => {
        const scene = getActiveScene(state);
        return withScene(
          state,
          syncBoundsToWorldResize(scene, {
            width: Math.max(1, action.width),
            height: Math.max(1, action.height),
          }) as GameSceneSpec,
          true,
        );
      })();
    case 'set-scene-background-layers': {
      const scene = getActiveScene(state);
      return withScene(state, { ...scene, backgroundLayers: [...action.layers] }, true);
    }
    case 'add-audio-asset-from-file': {
      const sounds = state.project.audio?.sounds ?? {};
      const base = assetIdBaseFromOriginalName(action.file.originalName, 'sound');
      const assetId = allocUniqueId(sounds, base);
      const nextProject: ProjectSpec = {
        ...state.project,
        audio: {
          ...state.project.audio,
          sounds: {
            ...sounds,
            [assetId]: {
              id: assetId,
              source: {
                kind: 'embedded',
                dataUrl: action.file.dataUrl,
                ...(action.file.originalName ? { originalName: action.file.originalName } : {}),
                ...(action.file.mimeType ? { mimeType: action.file.mimeType } : {}),
              },
            },
          },
        },
      };
      return {
        ...state,
        project: nextProject,
        dirty: true,
        error: undefined,
      };
    }
    case 'add-audio-asset-from-path': {
      const sounds = state.project.audio?.sounds ?? {};
      const rawSuggested = (action.suggestedId ?? '').trim();
      const derived = action.path.split('/').pop() ?? action.path;
      const base = rawSuggested.length > 0 ? rawSuggested : assetIdBaseFromOriginalName(derived, 'sound');
      const assetId = allocUniqueId(sounds, base);
      const nextProject: ProjectSpec = {
        ...state.project,
        audio: {
          ...state.project.audio,
          sounds: {
            ...sounds,
            [assetId]: {
              id: assetId,
              source: { kind: 'path', path: action.path },
            },
          },
        },
      };
      return {
        ...state,
        project: nextProject,
        dirty: true,
        error: undefined,
      };
    }
    case 'remove-audio-asset': {
      const sounds = state.project.audio?.sounds ?? {};
      if (!sounds[action.assetId]) return state;
      const { [action.assetId]: _removed, ...remaining } = sounds;
      void _removed;

      const scenes: Record<Id, GameSceneSpec> = {};
      for (const [sceneId, scene] of Object.entries(state.project.scenes)) {
        let nextScene: any = scene;

        if (scene.music?.assetId === action.assetId) {
          const { music: _music, ...rest } = nextScene as any;
          void _music;
          nextScene = rest;
        }

        if (Array.isArray(scene.ambience)) {
          const filtered = scene.ambience.filter((entry) => entry.assetId !== action.assetId);
          if (filtered.length === 0) {
            const { ambience: _ambience, ...rest } = nextScene as any;
            void _ambience;
            nextScene = rest;
          } else if (filtered.length !== scene.ambience.length) {
            nextScene = { ...(nextScene as any), ambience: filtered };
          }
        }

        scenes[sceneId] = nextScene as GameSceneSpec;
      }

      const nextProject: ProjectSpec = {
        ...state.project,
        audio: { ...state.project.audio, sounds: remaining },
        scenes,
      };

      return {
        ...state,
        project: nextProject,
        dirty: true,
        error: undefined,
      };
    }
    case 'set-scene-music': {
      const scene = getActiveScene(state);
      return withScene(state, { ...scene, music: action.music }, true);
    }
    case 'set-scene-ambience': {
      const scene = getActiveScene(state);
      const ambience = action.ambience.length > 0 ? action.ambience.map((entry) => ({ ...entry })) : [];
      return withScene(state, { ...scene, ambience }, true);
    }
    case 'create-input-map': {
      const inputMaps = state.project.inputMaps ?? {};
      const baseId = (action.mapId ?? '').trim();
      const mapId = baseId.length > 0 ? baseId : allocUniqueId(inputMaps, 'input-map');
      if (inputMaps[mapId]) return state;
      const nextProject: ProjectSpec = {
        ...state.project,
        inputMaps: {
          ...inputMaps,
          [mapId]: { actions: {} },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'duplicate-input-map': {
      const inputMaps = state.project.inputMaps ?? {};
      const source = inputMaps[action.sourceMapId];
      if (!source) return state;
      const nextIdBase = (action.nextMapId ?? '').trim();
      const nextMapId = nextIdBase.length > 0 ? nextIdBase : allocUniqueId(inputMaps, `${action.sourceMapId}_copy`);
      if (inputMaps[nextMapId]) return state;
      const clonedActions: Record<string, InputBindingSpec[]> = {};
      for (const [actionId, bindings] of Object.entries(source.actions ?? {})) {
        clonedActions[actionId] = Array.isArray(bindings) ? bindings.map((b) => ({ ...(b as any) })) : [];
      }
      const nextProject: ProjectSpec = {
        ...state.project,
        inputMaps: {
          ...inputMaps,
          [nextMapId]: { actions: clonedActions },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'remove-input-map': {
      const inputMaps = state.project.inputMaps ?? {};
      if (!inputMaps[action.mapId]) return state;
      const { [action.mapId]: _removed, ...remaining } = inputMaps;
      void _removed;

      const scenes: Record<Id, GameSceneSpec> = {};
      for (const [sceneId, scene] of Object.entries(state.project.scenes)) {
        const input = scene.input;
        if (!input || (input.activeMapId !== action.mapId && input.fallbackMapId !== action.mapId)) {
          scenes[sceneId] = scene;
          continue;
        }
        const nextInput: any = { ...input };
        if (nextInput.activeMapId === action.mapId) delete nextInput.activeMapId;
        if (nextInput.fallbackMapId === action.mapId) delete nextInput.fallbackMapId;
        const hasAny = typeof nextInput.activeMapId === 'string' || typeof nextInput.fallbackMapId === 'string';
        const nextScene: any = hasAny ? { ...scene, input: nextInput } : (() => {
          const { input: _input, ...rest } = scene as any;
          void _input;
          return rest;
        })();
        scenes[sceneId] = nextScene as GameSceneSpec;
      }

      const nextProject: any = {
        ...state.project,
        inputMaps: remaining,
        scenes,
      };
      if (nextProject.defaultInputMapId === action.mapId) delete nextProject.defaultInputMapId;

      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-input-binding': {
      const inputMaps = state.project.inputMaps ?? {};
      const map = inputMaps[action.mapId];
      if (!map) return state;
      const actionId = action.actionId.trim();
      if (!actionId) return state;
      const existing = map.actions?.[actionId] ?? [];
      const nextBindings = [...existing.map((b) => ({ ...(b as any) })), { ...(action.binding as any) }];
      const nextMap = {
        ...map,
        actions: {
          ...(map.actions ?? {}),
          [actionId]: nextBindings,
        },
      };
      const nextProject: ProjectSpec = {
        ...state.project,
        inputMaps: {
          ...inputMaps,
          [action.mapId]: nextMap,
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'remove-input-binding': {
      const inputMaps = state.project.inputMaps ?? {};
      const map = inputMaps[action.mapId];
      if (!map) return state;
      const bindings = map.actions?.[action.actionId];
      if (!Array.isArray(bindings) || bindings.length === 0) return state;
      if (action.index < 0 || action.index >= bindings.length) return state;
      const next = bindings.slice();
      next.splice(action.index, 1);
      const nextActions: any = { ...(map.actions ?? {}) };
      if (next.length === 0) {
        delete nextActions[action.actionId];
      } else {
        nextActions[action.actionId] = next.map((b: any) => ({ ...b }));
      }
      const nextMap = { ...map, actions: nextActions };
      const nextProject: ProjectSpec = {
        ...state.project,
        inputMaps: { ...inputMaps, [action.mapId]: nextMap },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'set-project-default-input-map': {
      const mapId = (action.mapId ?? '').trim();
      if (mapId && !state.project.inputMaps?.[mapId]) return state;
      const nextProject: any = { ...state.project };
      if (!mapId) {
        delete nextProject.defaultInputMapId;
      } else {
        nextProject.defaultInputMapId = mapId;
      }
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'set-scene-input': {
      const scene = getActiveScene(state);
      const input = action.input;
      const hasAny = Boolean(
        input
        && (input.activeMapId || input.fallbackMapId || (input as any).mouse)
      );
      if (!hasAny) {
        const { input: _input, ...rest } = scene as any;
        void _input;
        return withScene(state, rest as GameSceneSpec, true);
      }
      const nextInput: any = { ...(input ?? {}) };
      if (!nextInput.activeMapId) delete nextInput.activeMapId;
      if (!nextInput.fallbackMapId) delete nextInput.fallbackMapId;
      return withScene(state, { ...scene, input: nextInput } as GameSceneSpec, true);
    }
    case 'add-background-layer-from-file': {
      const scene = getActiveScene(state);
      const world = getSceneWorld(scene);
      const images = state.project.assets.images ?? {};
      const base = assetIdBaseFromOriginalName(action.file.originalName, 'background');
      const assetId = allocUniqueId(images, base);
      const layout: BackgroundLayerSpec['layout'] = action.defaults?.layout ?? 'cover';
      const isTiled = layout === 'tile';
      const depth = -100 * ((scene.backgroundLayers?.length ?? 0) + 1);
      const layer: BackgroundLayerSpec = {
        assetId,
        x: isTiled ? 0 : world.width / 2,
        y: isTiled ? 0 : world.height / 2,
        depth,
        layout,
      };

      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          images: {
            ...images,
            [assetId]: {
              id: assetId,
              source: {
                kind: 'embedded',
                dataUrl: action.file.dataUrl,
                ...(action.file.originalName ? { originalName: action.file.originalName } : {}),
                ...(action.file.mimeType ? { mimeType: action.file.mimeType } : {}),
              },
            },
          },
        },
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: {
            ...scene,
            backgroundLayers: [...(scene.backgroundLayers ?? []), layer],
          },
        },
      };

      return {
        ...state,
        project: nextProject,
        dirty: true,
        error: undefined,
      };
    }
    case 'add-image-asset-from-file': {
      const images = state.project.assets.images ?? {};
      const base = assetIdBaseFromOriginalName(action.file.originalName, 'image');
      const assetId = allocUniqueId(images, base);
      const rawName = (action.file.originalName ?? '').replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          images: {
            ...images,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: {
                kind: 'embedded',
                dataUrl: action.file.dataUrl,
                ...(action.file.originalName ? { originalName: action.file.originalName } : {}),
                ...(action.file.mimeType ? { mimeType: action.file.mimeType } : {}),
              },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-image-asset-from-path': {
      const images = state.project.assets.images ?? {};
      const rawSuggested = (action.suggestedId ?? '').trim();
      const derived = action.path.split('/').pop() ?? action.path;
      const base = rawSuggested.length > 0 ? rawSuggested : assetIdBaseFromOriginalName(derived, 'image');
      const assetId = allocUniqueId(images, base);
      const rawName = derived.replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          images: {
            ...images,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: { kind: 'path', path: action.path },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-spritesheet-asset-from-file': {
      const spriteSheets = state.project.assets.spriteSheets ?? {};
      const base = assetIdBaseFromOriginalName(action.file.originalName, 'spritesheet');
      const assetId = allocUniqueId(spriteSheets, base);
      const rawName = (action.file.originalName ?? '').replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          spriteSheets: {
            ...spriteSheets,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: {
                kind: 'embedded',
                dataUrl: action.file.dataUrl,
                ...(action.file.originalName ? { originalName: action.file.originalName } : {}),
                ...(action.file.mimeType ? { mimeType: action.file.mimeType } : {}),
              },
              grid: {
                frameWidth: Math.max(1, Math.floor(action.grid.frameWidth)),
                frameHeight: Math.max(1, Math.floor(action.grid.frameHeight)),
                columns: Math.max(1, Math.floor(action.grid.columns)),
                rows: Math.max(1, Math.floor(action.grid.rows)),
              },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-spritesheet-asset-from-path': {
      const spriteSheets = state.project.assets.spriteSheets ?? {};
      const rawSuggested = (action.suggestedId ?? '').trim();
      const derived = action.path.split('/').pop() ?? action.path;
      const base = rawSuggested.length > 0 ? rawSuggested : assetIdBaseFromOriginalName(derived, 'spritesheet');
      const assetId = allocUniqueId(spriteSheets, base);
      const rawName = derived.replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          spriteSheets: {
            ...spriteSheets,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: { kind: 'path', path: action.path },
              grid: {
                frameWidth: Math.max(1, Math.floor(action.grid.frameWidth)),
                frameHeight: Math.max(1, Math.floor(action.grid.frameHeight)),
                columns: Math.max(1, Math.floor(action.grid.columns)),
                rows: Math.max(1, Math.floor(action.grid.rows)),
              },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-font-asset-from-file': {
      const fonts = state.project.assets.fonts ?? {};
      const base = assetIdBaseFromOriginalName(action.file.originalName, 'font');
      const assetId = allocUniqueId(fonts, base);
      const rawName = (action.file.originalName ?? '').replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          fonts: {
            ...fonts,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: {
                kind: 'embedded',
                dataUrl: action.file.dataUrl,
                ...(action.file.originalName ? { originalName: action.file.originalName } : {}),
                ...(action.file.mimeType ? { mimeType: action.file.mimeType } : {}),
              },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'add-font-asset-from-path': {
      const fonts = state.project.assets.fonts ?? {};
      const rawSuggested = (action.suggestedId ?? '').trim();
      const derived = action.path.split('/').pop() ?? action.path;
      const base = rawSuggested.length > 0 ? rawSuggested : assetIdBaseFromOriginalName(derived, 'font');
      const assetId = allocUniqueId(fonts, base);
      const rawName = derived.replace(/\.[a-z0-9]+$/i, '').trim();
      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...state.project.assets,
          fonts: {
            ...fonts,
            [assetId]: {
              id: assetId,
              ...(rawName ? { name: rawName } : {}),
              source: { kind: 'path', path: action.path },
            },
          },
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'set-asset-display-name': {
      const nextName = (action.name ?? '').trim();
      const name = nextName.length > 0 ? nextName : undefined;

      if (action.assetKind === 'audio') {
        const sounds = state.project.audio?.sounds ?? {};
        const existing = sounds[action.assetId];
        if (!existing) return state;
        const nextProject: ProjectSpec = {
          ...state.project,
          audio: {
            ...state.project.audio,
            sounds: {
              ...sounds,
              [action.assetId]: {
                ...existing,
                ...(name ? { name } : (() => {
                  const { name: _name, ...rest } = existing as any;
                  void _name;
                  return rest;
                })()),
              },
            },
          },
        };
        return { ...state, project: nextProject, dirty: true, error: undefined };
      }

      const assets = state.project.assets;
      const collection = action.assetKind === 'image'
        ? assets.images
        : action.assetKind === 'spritesheet'
          ? assets.spriteSheets
          : assets.fonts;
      const existing = collection?.[action.assetId];
      if (!existing) return state;

      const nextCollection: any = {
        ...(collection ?? {}),
        [action.assetId]: {
          ...existing,
          ...(name ? { name } : (() => {
            const { name: _name, ...rest } = existing as any;
            void _name;
            return rest;
          })()),
        },
      };

      const nextProject: ProjectSpec = {
        ...state.project,
        assets: {
          ...assets,
          ...(action.assetKind === 'image' ? { images: nextCollection } : {}),
          ...(action.assetKind === 'spritesheet' ? { spriteSheets: nextCollection } : {}),
          ...(action.assetKind === 'font' ? { fonts: nextCollection } : {}),
        },
      };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'remove-asset': {
      const refs = getAssetReferences(state.project, action.assetKind, action.assetId);
      if (refs.count > 0) {
        return {
          ...state,
          error: `Cannot delete ${action.assetKind} asset "${action.assetId}" — it is still referenced (${refs.count}).`,
        };
      }

      if (action.assetKind === 'audio') {
        const sounds = state.project.audio?.sounds ?? {};
        if (!sounds[action.assetId]) return state;
        const { [action.assetId]: _removed, ...remaining } = sounds;
        void _removed;
        const nextProject: ProjectSpec = {
          ...state.project,
          audio: { ...state.project.audio, sounds: remaining },
        };
        return { ...state, project: nextProject, dirty: true, error: undefined };
      }

      const nextAssets: any = { ...state.project.assets };
      const removeFrom = (record: Record<Id, any>) => {
        if (!record[action.assetId]) return null;
        const { [action.assetId]: _removed, ...rest } = record;
        void _removed;
        return rest;
      };

      if (action.assetKind === 'image') {
        const updated = removeFrom(state.project.assets.images ?? {});
        if (!updated) return state;
        nextAssets.images = updated;
      } else if (action.assetKind === 'spritesheet') {
        const updated = removeFrom(state.project.assets.spriteSheets ?? {});
        if (!updated) return state;
        nextAssets.spriteSheets = updated;
      } else if (action.assetKind === 'font') {
        const updated = removeFrom(state.project.assets.fonts ?? {});
        if (!updated) return state;
        nextAssets.fonts = updated;
      }

      const nextProject: ProjectSpec = { ...state.project, assets: nextAssets };
      return { ...state, project: nextProject, dirty: true, error: undefined };
    }
    case 'create-entity-from-asset': {
      const scene = getActiveScene(state);
      const entityId = allocUniqueId(scene.entities ?? {}, 'e');
      const world = getSceneWorld(scene);
      const at = action.at ?? { x: world.width / 2, y: world.height / 2 };
      const defaultSize = 64;
      const spritesheet = action.assetKind === 'spritesheet'
        ? state.project.assets.spriteSheets?.[action.assetId]
        : undefined;
      const width = spritesheet?.grid?.frameWidth ?? defaultSize;
      const height = spritesheet?.grid?.frameHeight ?? defaultSize;

      const entity: EntitySpec = resolveEntityDefaults({
        id: entityId,
        x: at.x,
        y: at.y,
        width,
        height,
        rotationDeg: 0,
        asset: {
          source: { kind: 'asset', assetId: action.assetId },
          imageType: action.assetKind === 'spritesheet' ? 'spritesheet' : 'image',
          ...(spritesheet ? { grid: spritesheet.grid } : {}),
          frame: action.assetKind === 'spritesheet' ? { kind: 'spritesheet-frame', frameIndex: 0 } : { kind: 'single' },
        },
      });

      return withScene(state, { ...scene, entities: { ...scene.entities, [entityId]: entity } }, true);
    }
    case 'assign-asset-to-target': {
      const scene = state.project.scenes[action.target.sceneId];
      if (!scene) return state;
      const typedScene = scene as GameSceneSpec;

      if (action.target.kind === 'background-layer') {
        if (action.assetKind !== 'image') return state;
        const world = getSceneWorld(typedScene);
        const layers = [...(typedScene.backgroundLayers ?? [])];
        const desiredIndex = typeof action.target.layerIndex === 'number' ? action.target.layerIndex : layers.length;
        if (layers.length === 0 || desiredIndex >= layers.length) {
          layers.push({
            assetId: action.assetId,
            x: world.width / 2,
            y: world.height / 2,
            depth: -100,
            layout: 'cover',
          });
        } else {
          const index = Math.max(0, Math.min(layers.length - 1, desiredIndex));
          layers[index] = { ...layers[index], assetId: action.assetId };
        }
        const nextScenes = { ...state.project.scenes, [action.target.sceneId]: { ...typedScene, backgroundLayers: layers } };
        return { ...state, project: { ...state.project, scenes: nextScenes }, dirty: true, error: undefined };
      }

      if (action.target.kind === 'scene-music') {
        if (action.assetKind !== 'audio') return state;
        const existing = typedScene.music;
        const music = {
          assetId: action.assetId,
          loop: existing?.loop ?? true,
          volume: existing?.volume ?? 1,
          fadeMs: existing?.fadeMs ?? 0,
        };
        const nextScenes = { ...state.project.scenes, [action.target.sceneId]: { ...typedScene, music } };
        return { ...state, project: { ...state.project, scenes: nextScenes }, dirty: true, error: undefined };
      }

      if (action.target.kind === 'scene-ambience') {
        if (action.assetKind !== 'audio') return state;
        const ambience = [...(typedScene.ambience ?? [])].map((entry) => ({ ...entry }));
        if (typeof action.target.index === 'number' && ambience[action.target.index]) {
          ambience[action.target.index] = { ...ambience[action.target.index], assetId: action.assetId };
        } else {
          ambience.push({ assetId: action.assetId, loop: true, volume: 1 });
        }
        const nextScenes = { ...state.project.scenes, [action.target.sceneId]: { ...typedScene, ambience } };
        return { ...state, project: { ...state.project, scenes: nextScenes }, dirty: true, error: undefined };
      }

      if (action.target.kind === 'entity-sprite') {
        if (action.assetKind !== 'image' && action.assetKind !== 'spritesheet') return state;
        const entity = typedScene.entities?.[action.target.entityId];
        if (!entity) return state;
        const nextAsset: SpriteAssetSpec = {
          ...(entity.asset ?? { imageType: action.assetKind === 'spritesheet' ? 'spritesheet' : 'image', source: { kind: 'asset', assetId: action.assetId } }),
          source: { kind: 'asset', assetId: action.assetId },
          imageType: action.assetKind === 'spritesheet' ? 'spritesheet' : 'image',
          ...(action.assetKind === 'spritesheet'
            ? { grid: state.project.assets.spriteSheets?.[action.assetId]?.grid, frame: entity.asset?.frame?.kind === 'spritesheet-frame' ? entity.asset.frame : { kind: 'spritesheet-frame', frameIndex: 0 } }
            : { grid: undefined, frame: { kind: 'single' } }),
        };
        const nextEntity: EntitySpec = { ...entity, asset: nextAsset };
        return withScene(state, { ...typedScene, entities: { ...typedScene.entities, [action.target.entityId]: nextEntity } }, true);
      }

      return state;
    }
    case 'update-background-layer': {
      const scene = getActiveScene(state);
      const layers = [...(scene.backgroundLayers ?? [])];
      const existing = layers[action.index];
      if (!existing) return state;
      layers[action.index] = { ...existing, ...action.patch };
      return withScene(state, { ...scene, backgroundLayers: layers }, true);
    }
    case 'remove-background-layer': {
      const scene = getActiveScene(state);
      const layers = [...(scene.backgroundLayers ?? [])];
      if (!layers[action.index]) return state;
      layers.splice(action.index, 1);
      return withScene(state, { ...scene, backgroundLayers: layers }, true);
    }
    case 'move-background-layer': {
      const scene = getActiveScene(state);
      const layers = [...(scene.backgroundLayers ?? [])];
      if (!layers[action.fromIndex]) return state;
      const clampedTo = Math.max(0, Math.min(layers.length - 1, action.toIndex));
      if (action.fromIndex === clampedTo) return state;
      const [moved] = layers.splice(action.fromIndex, 1);
      layers.splice(clampedTo, 0, moved);
      return withScene(state, { ...scene, backgroundLayers: layers }, true);
    }
    case 'add-collision-rule': {
      const scene = getActiveScene(state);
      const existing = scene.collisionRules ?? [];
      const existingIds = Object.fromEntries(existing.map((r) => [r.id, true]));
      const id = allocUniqueId(existingIds, 'rule-1');
      const rule: CollisionRuleSpec = {
        id,
        a: { type: 'layer', layer: 'player' },
        b: { type: 'layer', layer: 'world' },
        interaction: 'block',
      };
      return withScene(state, { ...scene, collisionRules: [...existing, rule] } as GameSceneSpec, true);
    }
    case 'update-collision-rule': {
      const scene = getActiveScene(state);
      const rules = [...(scene.collisionRules ?? [])];
      const index = rules.findIndex((r) => r.id === action.id);
      if (index < 0) return state;
      rules[index] = { ...rules[index], ...action.patch };
      return withScene(state, { ...scene, collisionRules: rules } as GameSceneSpec, true);
    }
    case 'remove-collision-rule': {
      const scene = getActiveScene(state);
      const rules = [...(scene.collisionRules ?? [])];
      const index = rules.findIndex((r) => r.id === action.id);
      if (index < 0) return state;
      rules.splice(index, 1);
      return withScene(state, { ...scene, collisionRules: rules } as GameSceneSpec, true);
    }
    case 'add-trigger-zone': {
      const scene = getActiveScene(state);
      const existing = scene.triggers ?? [];
      const existingIds = Object.fromEntries(existing.map((z) => [z.id, true]));
      const id = allocUniqueId(existingIds, 'trigger-1');
      const world = getSceneWorld(scene);
      const zone: TriggerZoneSpec = {
        id,
        name: id,
        enabled: true,
        rect: {
          x: Math.max(0, Math.round(world.width / 2 - 64)),
          y: Math.max(0, Math.round(world.height / 2 - 48)),
          width: 128,
          height: 96,
        },
      };
      return withScene(
        { ...state, selection: { kind: 'trigger', id } },
        { ...scene, triggers: [...existing, zone] } as GameSceneSpec,
        true,
        { kind: 'trigger', id },
      );
    }
    case 'update-trigger-zone': {
      const scene = getActiveScene(state);
      const zones = [...(scene.triggers ?? [])];
      const index = zones.findIndex((z) => z.id === action.id);
      if (index < 0) return state;
      zones[index] = { ...zones[index], ...action.patch } as TriggerZoneSpec;
      return withScene(state, { ...scene, triggers: zones } as GameSceneSpec, true);
    }
    case 'remove-trigger-zone': {
      const scene = getActiveScene(state);
      const zones = [...(scene.triggers ?? [])];
      const index = zones.findIndex((z) => z.id === action.id);
      if (index < 0) return state;
      zones.splice(index, 1);
      const nextSelection = state.selection.kind === 'trigger' && state.selection.id === action.id ? ({ kind: 'none' } as const) : state.selection;
      return withScene(
        { ...state, selection: nextSelection },
        { ...scene, triggers: zones } as GameSceneSpec,
        true,
        nextSelection,
      );
    }
    case 'update-entity': {
      const scene = getActiveScene(state);
      if (!scene.entities[action.id]) return state;
      return withScene(state, {
        ...scene,
        entities: {
          ...scene.entities,
          [action.id]: action.next,
        },
      }, true);
    }
    case 'import-entities':
      return importEntities(state, action.drafts);
    case 'update-group': {
      const scene = getActiveScene(state);
      if (!scene.groups[action.id]) return state;
      return withScene(state, {
        ...scene,
        groups: {
          ...scene.groups,
          [action.id]: action.next,
        },
      }, true);
    }
    case 'create-attachment': {
      const scene = getActiveScene(state);
      const { scene: nextScene, attachmentId } = createAttachment(scene, action.target, action.presetId, {
        applyTo: action.target.type === 'group' ? 'group' : undefined,
      });
      return withScene(
        { ...state, selection: { kind: 'attachment', id: attachmentId } },
        nextScene as GameSceneSpec,
        true,
        { kind: 'attachment', id: attachmentId },
      );
    }
    case 'update-attachment': {
      const scene = getActiveScene(state);
      const nextScene = updateAttachment(scene, action.id, action.next);
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true);
    }
    case 'remove-attachment': {
      const scene = getActiveScene(state);
      const nextScene = removeAttachment(scene, action.id);
      if (nextScene === scene) return state;
      return withScene({ ...state, selection: { kind: 'none' } }, nextScene as GameSceneSpec, true, { kind: 'none' });
    }
    case 'move-attachment': {
      const scene = getActiveScene(state);
      const nextScene = moveAttachmentWithinTarget(scene, action.id, action.direction);
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true);
    }
    case 'toggle-group-expanded':
      return {
        ...state,
        expandedGroups: {
          ...state.expandedGroups,
          [action.id]: !state.expandedGroups[action.id],
        },
      };
    case 'move-entity': {
      const scene = getActiveScene(state);
      const entity = scene.entities[action.id];
      if (!entity) return state;
      const dx = Math.round(action.dx);
      const dy = Math.round(action.dy);
      return withScene(state, {
        ...scene,
        entities: {
          ...scene.entities,
          [action.id]: {
            ...entity,
            x: entity.x + dx,
            y: entity.y + dy,
          },
        },
      }, true);
    }
    case 'move-group': {
      const scene = getActiveScene(state);
      const group = scene.groups[action.id];
      if (!group) return state;
      const dx = Math.round(action.dx);
      const dy = Math.round(action.dy);
      const updatedEntities = { ...scene.entities };
      for (const entityId of group.members) {
        const entity = updatedEntities[entityId];
        if (entity) {
          updatedEntities[entityId] = {
            ...entity,
            x: entity.x + dx,
            y: entity.y + dy,
          };
        }
      }
      return withScene(state, {
        ...scene,
        entities: updatedEntities,
        groups: {
          ...scene.groups,
          [action.id]: updateGroupLayoutPosition(group, dx, dy),
        },
      }, true);
    }
    case 'select-multiple':
      if (!action.additive) {
        if (action.entityIds.length === 0) {
          return { ...state, selection: { kind: 'none' } };
        } else if (action.entityIds.length === 1) {
          return { ...state, selection: { kind: 'entity', id: action.entityIds[0] } };
        } else {
          return { ...state, selection: { kind: 'entities', ids: action.entityIds } };
        }
      }

      // Additive selection toggles ids against the current entity/entities selection.
      // (Marquee can still implement union by emitting a full replacement selection.)
      const baseIds =
        state.selection.kind === 'entities'
          ? state.selection.ids
          : state.selection.kind === 'entity'
            ? [state.selection.id]
            : [];

      const nextIds = [...baseIds];
      for (const id of action.entityIds) {
        const index = nextIds.indexOf(id);
        if (index >= 0) {
          nextIds.splice(index, 1);
        } else {
          nextIds.push(id);
        }
      }

      if (nextIds.length === 0) {
        return { ...state, selection: { kind: 'none' } };
      }
      if (nextIds.length === 1) {
        return { ...state, selection: { kind: 'entity', id: nextIds[0] } };
      }
      return { ...state, selection: { kind: 'entities', ids: nextIds } };
    case 'delete-selection': {
      const selection = state.selection;
      if (selection.kind === 'none') return state;

      const scene = getActiveScene(state);
      let nextScene: GameSceneSpec = scene;

      if (selection.kind === 'trigger') {
        const zones = [...(scene.triggers ?? [])];
        const index = zones.findIndex((z) => z.id === selection.id);
        if (index < 0) return state;
        zones.splice(index, 1);
        nextScene = { ...scene, triggers: zones } as GameSceneSpec;
      } else {
        const items: Array<{ kind: 'entity' | 'group' | 'attachment'; id: Id }> = [];
        if (selection.kind === 'entity') items.push({ kind: 'entity', id: selection.id });
        if (selection.kind === 'group') items.push({ kind: 'group', id: selection.id });
        if (selection.kind === 'attachment') items.push({ kind: 'attachment', id: selection.id });
        if (selection.kind === 'entities') {
          for (const id of selection.ids) items.push({ kind: 'entity', id });
        }

        for (const item of items) {
          nextScene = removeSceneGraphItem(nextScene, item) as GameSceneSpec;
        }
      }

      if (nextScene === scene) return state;
      const nextExpandedGroups = syncExpandedGroupsToScene(state.expandedGroups, nextScene);
      return withScene({ ...state, selection: { kind: 'none' } }, nextScene, true, { kind: 'none' }, nextExpandedGroups);
    }
    case 'move-entities': {
      const scene = getActiveScene(state);
      const dx = Math.round(action.dx);
      const dy = Math.round(action.dy);
      const updatedEntities = { ...scene.entities };
      for (const entityId of action.entityIds) {
        const entity = updatedEntities[entityId];
        if (entity) {
          updatedEntities[entityId] = {
            ...entity,
            x: entity.x + dx,
            y: entity.y + dy,
          };
        }
      }
      return withScene(state, {
        ...scene,
        entities: updatedEntities,
      }, true);
    }
    case 'duplicate-entities': {
      const scene = getActiveScene(state);
      const uniqueIds = [...new Set(action.entityIds)];
      if (uniqueIds.length === 0) return state;

      const entities: Record<Id, EntitySpec> = { ...scene.entities };
      const groups: Record<Id, GroupSpec> = { ...scene.groups };
      const duplicatedIds: Id[] = [];

      for (const sourceId of uniqueIds) {
        const source = scene.entities[sourceId];
        if (!source) continue;

        const nextId = allocUniqueId(entities, `${sourceId}-copy`);
        duplicatedIds.push(nextId);
        entities[nextId] = { ...source, id: nextId };

        const containingGroupId = Object.keys(groups).find((groupId) => groups[groupId]?.members.includes(sourceId));
        if (!containingGroupId) continue;
        const group = groups[containingGroupId];
        if (!group) continue;
        groups[containingGroupId] = {
          ...group,
          members: [...group.members, nextId],
          layout: { type: 'freeform' },
        };
      }

      if (duplicatedIds.length === 0) return state;

      const nextScene: GameSceneSpec = { ...scene, entities, groups };
      const selection: Selection = duplicatedIds.length === 1
        ? { kind: 'entity', id: duplicatedIds[0] }
        : { kind: 'entities', ids: duplicatedIds };
      return withScene(state, nextScene, true, selection, syncExpandedGroupsToScene(state.expandedGroups, nextScene));
    }
    case 'set-entities-asset': {
      const scene = getActiveScene(state);
      const uniqueIds = [...new Set(action.entityIds)].filter((id) => Boolean(scene.entities[id]));
      if (uniqueIds.length === 0) return state;

      const entities: Record<Id, EntitySpec> = { ...scene.entities };
      for (const id of uniqueIds) {
        entities[id] = {
          ...entities[id],
          asset: action.asset,
        };
      }

      return withScene(state, { ...scene, entities } as GameSceneSpec, true);
    }
    case 'arrange-group-grid': {
      const scene = getActiveScene(state);
      const nextScene = applyGroupGridLayout(scene, action.id, action.layout);
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true);
    }
    case 'arrange-group': {
      const scene = getActiveScene(state);
      const nextScene = applyGroupArrangeLayout(scene, action.id, action.arrangeKind, action.params);
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true);
    }
    case 'create-group-from-arrange': {
      const scene = getActiveScene(state);
      const template = scene.entities[action.templateEntityId];
      if (!template) return state;

      const rawName = action.name.trim();
      const formationName = rawName.length > 0 ? rawName : getNextFormationName(scene);
      const groupId = createGroupIdFromName(scene, formationName);

      const world = scene.world ?? { width: 1024, height: 768 };
      const baseX = world.width / 2;
      const baseY = world.height / 2;

      let count = Math.max(1, Math.floor(Number(action.memberCount ?? 12)));
      if (action.arrangeKind === 'grid') {
        const rows = Math.max(1, Math.floor(Number((action.params as any).rows ?? 1)));
        const cols = Math.max(1, Math.floor(Number((action.params as any).cols ?? 1)));
        count = rows * cols;
      }
      count = Math.max(1, Math.min(200, count));

      const { id: _id, name: _name, x: _x, y: _y, ...templateFields } = template;
      const nextEntities = { ...scene.entities };
      const memberIds: Id[] = [];
      const createdAt = Date.now();

      for (let index = 0; index < count; index += 1) {
        const id = `e-form-${createdAt}-${index}`;
        memberIds.push(id);
        nextEntities[id] = resolveEntityDefaults({
          ...templateFields,
          id,
          name: `${template.name ?? template.id} ${index + 1}`,
          x: baseX,
          y: baseY,
        });
      }

      const nextScene: GameSceneSpec = {
        ...scene,
        entities: nextEntities,
        groups: {
          ...scene.groups,
          [groupId]: createGroupSpec(groupId, memberIds, formationName),
        },
      };

      const arranged = applyGroupArrangeLayout(nextScene, groupId, action.arrangeKind, action.params);
      const strippedLayout: GameSceneSpec = {
        ...arranged,
        groups: {
          ...arranged.groups,
          [groupId]: {
            ...arranged.groups[groupId],
            layout: { type: 'freeform' },
          },
        },
      };

      return {
        ...withScene(state, strippedLayout, true, { kind: 'group', id: groupId }),
        expandedGroups: {
          ...state.expandedGroups,
          [groupId]: true,
        },
      };
    }
    case 'update-bounds': {
      const scene = getActiveScene(state);
      const attachment = scene.attachments[action.id];
      if (!attachment || attachment.presetId !== 'MoveUntil') return state;
      if (!attachment.condition || attachment.condition.type !== 'BoundsHit') return state;
      const clampedBounds = {
        minX: Math.min(action.bounds.minX, action.bounds.maxX),
        maxX: Math.max(action.bounds.minX, action.bounds.maxX),
        minY: Math.min(action.bounds.minY, action.bounds.maxY),
        maxY: Math.max(action.bounds.minY, action.bounds.maxY),
      };
      return withScene(state, updateAttachment(scene, attachment.id, {
        ...attachment,
        condition: {
          ...attachment.condition,
          bounds: clampedBounds,
        },
      }) as GameSceneSpec, true);
    }
    case 'begin-canvas-interaction':
      return {
        ...state,
        interaction: {
          kind: action.kind,
          id: action.id,
          handle: action.handle,
        },
      };
    case 'end-canvas-interaction':
      return {
        ...state,
        interaction: undefined,
      };
    case 'create-group-from-selection': {
      if (state.selection.kind !== 'entities' || state.selection.ids.length === 0) return state;
      const scene = getActiveScene(state);

      const groupedEntityIds = new Set(Object.values(scene.groups).flatMap((group) => group.members));
      const ungroupedSelection = state.selection.ids.filter((id) => !groupedEntityIds.has(id));
      if (ungroupedSelection.length < 2) return state;

      const groupId = `g-${Date.now()}`;
      const newGroup = createGroupSpec(groupId, ungroupedSelection, action.name.trim() || getNextFormationName(scene));

      const nextScene: GameSceneSpec = {
        ...scene,
        groups: {
          ...scene.groups,
          [groupId]: newGroup,
        },
      };

      return {
        ...withScene(state, nextScene, true, { kind: 'group', id: groupId }),
        expandedGroups: {
          ...state.expandedGroups,
          [groupId]: true,
        },
        pendingGroupRestore: undefined,
      };
    }
    case 'ungroup-group': {
      const scene = getActiveScene(state);
      const removed = removeGroupKeepMembers(scene, action.id);
      if (!removed.removed) return state;

      const { group, attachments } = removed.removed;
      const { [group.id]: _removedExpanded, ...expandedGroups } = state.expandedGroups;
      void _removedExpanded;

      return {
        ...withScene(state, removed.scene as GameSceneSpec, true, { kind: 'entities', ids: group.members }, syncExpandedGroupsToScene(expandedGroups, removed.scene)),
        selection: { kind: 'entities', ids: group.members },
        expandedGroups: syncExpandedGroupsToScene(expandedGroups, removed.scene),
        pendingGroupRestore: { group, attachments },
      };
    }
    case 'group-selection': {
      if (state.selection.kind !== 'entities' || state.selection.ids.length < 2) return state;
      const scene = getActiveScene(state);

      const selectionIds = state.selection.ids;
      const restore = state.pendingGroupRestore;
      if (restore && idsEqualAsSet(selectionIds, restore.group.members) && !scene.groups[restore.group.id]) {
        return {
          ...withScene(state, {
            ...scene,
            groups: {
              ...scene.groups,
              [restore.group.id]: restore.group,
            },
            attachments: {
              ...scene.attachments,
              ...restore.attachments,
            },
          } as GameSceneSpec, true, { kind: 'group', id: restore.group.id }),
          selection: { kind: 'group', id: restore.group.id },
          expandedGroups: {
            ...state.expandedGroups,
            [restore.group.id]: true,
          },
          pendingGroupRestore: undefined,
        };
      }

      const groupId = `g-${Date.now()}`;
      const newGroup = createGroupSpec(groupId, selectionIds, action.name.trim() || getNextFormationName(scene));

      return {
        ...withScene(state, {
          ...scene,
          groups: {
            ...scene.groups,
            [groupId]: newGroup,
          },
        } as GameSceneSpec, true, { kind: 'group', id: groupId }),
        expandedGroups: {
          ...state.expandedGroups,
          [groupId]: true,
        },
        pendingGroupRestore: undefined,
      };
    }
    case 'delete-group': {
      const scene = getActiveScene(state);
      const removed = removeGroupKeepMembers(scene, action.id);
      if (!removed.removed) return state;

      const { group } = removed.removed;
      const { [group.id]: _removedExpanded, ...expandedGroups } = state.expandedGroups;
      void _removedExpanded;

      return {
        ...withScene(state, removed.scene as GameSceneSpec, true, { kind: 'entities', ids: group.members }, syncExpandedGroupsToScene(expandedGroups, removed.scene)),
        selection: { kind: 'entities', ids: group.members },
        expandedGroups: syncExpandedGroupsToScene(expandedGroups, removed.scene),
        pendingGroupRestore: undefined,
      };
    }
    case 'add-entities-to-group': {
      const scene = getActiveScene(state);
      const nextScene = addEntitiesToGroup(scene, action.groupId, action.entityIds);
      if (nextScene === scene) return state;
      return {
        ...withScene(state, nextScene as GameSceneSpec, true, { kind: 'group', id: action.groupId }),
        selection: { kind: 'group', id: action.groupId },
        expandedGroups: {
          ...syncExpandedGroupsToScene(state.expandedGroups, nextScene),
          [action.groupId]: true,
        },
        pendingGroupRestore: undefined,
      };
    }
    case 'insert-entities-into-group': {
      const scene = getActiveScene(state);
      const nextScene = insertEntitiesIntoGroup(scene, action.groupId, action.entityIds, action.index);
      if (nextScene === scene) return state;
      return {
        ...withScene(state, nextScene as GameSceneSpec, true, { kind: 'group', id: action.groupId }),
        selection: { kind: 'group', id: action.groupId },
        expandedGroups: {
          ...syncExpandedGroupsToScene(state.expandedGroups, nextScene),
          [action.groupId]: true,
        },
        pendingGroupRestore: undefined,
      };
    }
    case 'remove-entities-from-groups': {
      const scene = getActiveScene(state);
      const nextScene = removeEntitiesFromGroups(scene, action.entityIds);
      if (nextScene === scene) return state;
      const nextIds = action.entityIds.filter((id) => Boolean(nextScene.entities[id]));
      const nextSelection: Selection =
        nextIds.length === 0
          ? { kind: 'none' }
          : nextIds.length === 1
            ? { kind: 'entity', id: nextIds[0] }
            : { kind: 'entities', ids: nextIds };

      return {
        ...withScene(state, nextScene as GameSceneSpec, true, nextSelection, syncExpandedGroupsToScene(state.expandedGroups, nextScene)),
        selection: nextSelection,
        expandedGroups: syncExpandedGroupsToScene(state.expandedGroups, nextScene),
        pendingGroupRestore: undefined,
      };
    }
    case 'remove-scene-graph-item': {
      const scene = getActiveScene(state);
      const next = removeSceneGraphItem(scene, action.item);
      if (next === scene) return state;
      return withScene({ ...state, selection: { kind: 'none' } }, next as GameSceneSpec, true, { kind: 'none' });
    }
    case 'remove-entity-from-group': {
      const scene = getActiveScene(state);
      const nextScene = removeEntityFromGroup(scene, action.groupId, action.entityId);
      if (nextScene === scene) return state;
      const groupStillExists = Boolean(nextScene.groups[action.groupId]);
      const nextExpandedGroups = { ...state.expandedGroups };
      if (!groupStillExists) {
        delete nextExpandedGroups[action.groupId];
      }
      return {
        ...withScene(
          state,
          nextScene as GameSceneSpec,
          true,
          groupStillExists ? { kind: 'group', id: action.groupId } : { kind: 'entity', id: action.entityId },
          syncExpandedGroupsToScene(nextExpandedGroups, nextScene),
        ),
        selection: groupStillExists ? { kind: 'group', id: action.groupId } : { kind: 'entity', id: action.entityId },
        expandedGroups: syncExpandedGroupsToScene(nextExpandedGroups, nextScene),
      };
    }
    case 'dissolve-group': {
      const scene = getActiveScene(state);
      const group = scene.groups[action.id];
      if (!group) return state;
      const nextScene = dissolveGroup(scene, action.id);

      return {
        ...withScene(state, nextScene as GameSceneSpec, true, { kind: 'entities', ids: group.members }),
        selection: { kind: 'entities', ids: group.members },
        expandedGroups: syncExpandedGroupsToScene(state.expandedGroups, nextScene),
      };
    }
    case 'convert-group-layout-freeform': {
      const scene = getActiveScene(state);
      const group = scene.groups[action.id];
      if (!group) return state;
      const nextScene: GameSceneSpec = {
        ...scene,
        groups: {
          ...scene.groups,
          [action.id]: {
            ...group,
            layout: { type: 'freeform' },
          },
        },
      };
      return withScene(state, nextScene, true, { kind: 'group', id: action.id });
    }
    case 'convert-group-layout-grid': {
      const scene = getActiveScene(state);
      const group = scene.groups[action.id];
      if (!group) return state;
      const inferred = inferGroupGridLayout(scene, action.id);
      const templateId = group.members.find((id) => Boolean(scene.entities[id]));
      const template = templateId ? scene.entities[templateId] : undefined;
      const fallback: GroupGridLayout = {
        rows: Math.max(1, Math.floor(Number(action.rows ?? 1))),
        cols: Math.max(1, Math.floor(Number(action.cols ?? 1))),
        startX: template ? template.x : 0,
        startY: template ? template.y : 0,
        spacingX: 48,
        spacingY: 40,
      };
      const nextLayout: GroupGridLayout = {
        ...(inferred ?? fallback),
        rows: Math.max(1, Math.floor(Number(action.rows ?? (inferred?.rows ?? 1)))),
        cols: Math.max(1, Math.floor(Number(action.cols ?? (inferred?.cols ?? 1)))),
      };
      const nextScene = applyGroupGridLayoutPreserveMembers(scene, action.id, nextLayout);
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true, { kind: 'group', id: action.id });
    }
    case 'convert-group-layout-arrange': {
      const scene = getActiveScene(state);
      const nextScene = applyGroupArrangeLayout(scene, action.id, action.arrangeKind, {});
      if (nextScene === scene) return state;
      return withScene(state, nextScene as GameSceneSpec, true, { kind: 'group', id: action.id });
    }
    case 'toggle-mode':
      return {
        ...state,
        mode: state.mode === 'edit' ? 'play' : 'edit',
      };
    case 'dismiss-view-hint':
      return {
        ...state,
        hasSeenViewHint: true,
      };
    default:
      return state;
  }
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'history-undo') return applyUndo(state);
  if (action.type === 'history-redo') return applyRedo(state);

  const stateBefore = state;
  let stateAfter = applyAction(state, action);

  if (action.type === 'begin-canvas-interaction') {
    const sceneId = stateBefore.currentSceneId;
    const beforeScene = stateBefore.project.scenes[sceneId];
    if (!beforeScene) return stateAfter;
    return {
      ...stateAfter,
      history: {
        ...stateAfter.history,
        pending: {
          scope: 'scene',
          kind: 'canvas-interaction',
          sceneId,
          beforeScene,
          beforeSelection: stateBefore.selection,
          beforeExpandedGroups: stateBefore.expandedGroups,
          beforeDirty: stateBefore.dirty,
          changed: false,
        },
      },
    };
  }

  if (stateBefore.history.pending && isPendingInteractionMutation(action)) {
    const pending = stateBefore.history.pending;
    return {
      ...stateAfter,
      history: {
        ...stateAfter.history,
        pending: { ...pending, changed: true },
      },
    };
  }

  if (action.type === 'end-canvas-interaction') {
    const pending = stateBefore.history.pending;
    const cleared: EditorState = { ...stateAfter, history: { ...stateAfter.history, pending: undefined } };
    if (!pending || !pending.changed) return cleared;

    const afterScene = cleared.project.scenes[pending.sceneId];
    if (!afterScene) return cleared;

    const entry: HistoryEntry = {
      scope: 'scene',
      kind: 'canvas-interaction',
      timestampMs: Date.now(),
      sceneId: pending.sceneId,
      beforeScene: pending.beforeScene,
      afterScene,
      beforeDirty: pending.beforeDirty,
      afterDirty: cleared.dirty,
      beforeSelection: pending.beforeSelection,
      afterSelection: cleared.selection,
    };

    return {
      ...cleared,
      history: {
        past: pushHistoryPast(stateBefore.history.past, entry),
        future: [],
        pending: undefined,
      },
    };
  }

  return recordHistoryForAction(stateBefore, stateAfter, action);
}

function loadStoredProjectYaml(): ProjectSpec | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = parseProjectYaml(raw);
    for (const scene of Object.values(parsed.scenes)) validateSceneSpec(scene);
    return parsed;
  } catch {
    return null;
  }
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const statusTimeoutRef = React.useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const [config, registry] = await Promise.all([loadEditorConfig(), loadEditorRegistry()]);
      if (cancelled) return;

      const storedMode = typeof window !== 'undefined'
        ? coerceStartupMode(window.localStorage.getItem(STARTUP_MODE_STORAGE_KEY), config.startupMode)
        : config.startupMode;
      const storedThemeMode = typeof window !== 'undefined'
        ? coerceThemeMode(window.localStorage.getItem(THEME_MODE_STORAGE_KEY))
        : 'system';
      const storedUiScale = typeof window !== 'undefined'
        ? coerceUiScale(window.localStorage.getItem(UI_SCALE_STORAGE_KEY), DEFAULT_UI_SCALE)
        : DEFAULT_UI_SCALE;
      const project = storedMode === 'reload_last_yaml' ? (loadStoredProjectYaml() ?? createEmptyProject()) : createEmptyProject();
      const currentSceneId = project.initialSceneId;

      dispatch({ type: 'initialize', project, currentSceneId, startupMode: storedMode, themeMode: storedThemeMode, uiScale: storedUiScale, registry });
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.initialized) return;
    try {
      window.localStorage.setItem(STARTUP_MODE_STORAGE_KEY, state.startupMode);
    } catch {
      // ignore storage errors
    }
  }, [state.initialized, state.startupMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.initialized) return;
    try {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, state.themeMode);
    } catch {
      // ignore storage errors
    }
  }, [state.initialized, state.themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.initialized) return;
    try {
      window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(state.uiScale));
    } catch {
      // ignore storage errors
    }
  }, [state.initialized, state.uiScale]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.initialized) return;
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, serializeProjectToYaml(state.project));
    } catch {
      // ignore storage errors
    }
  }, [state.initialized, state.project]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (statusTimeoutRef.current != null) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    if (!state.statusExpiresAt || !state.statusMessage) return;
    const delayMs = Math.max(0, state.statusExpiresAt - Date.now());
    statusTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: 'set-status', message: undefined, expiresAt: undefined });
    }, delayMs);

    return () => {
      if (statusTimeoutRef.current != null) {
        window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [state.statusExpiresAt, state.statusMessage]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): { state: EditorState; dispatch: React.Dispatch<EditorAction> } {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorStore not found');
  return ctx;
}
