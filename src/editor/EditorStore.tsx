import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  EditorRegistryConfig,
  GroupSpec,
  Id,
  GameSceneSpec,
  ProjectSpec,
  SceneSpec,
  StartupMode,
  type EntitySpec,
} from '../model/types';
import { createEmptyProject, createEmptyGameScene } from '../model/emptyProject';
import { validateSceneSpec } from '../model/validation';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { applyGroupArrangeLayout, applyGroupGridLayout, type GroupGridLayout } from './formationLayout';
import { dissolveGroup, removeEntityFromGroup, updateGroupLayoutPosition } from './groupCommands';
import { syncBoundsToWorldResize } from './worldBounds';
import { loadEditorConfig, loadEditorRegistry, coerceStartupMode, EMPTY_EDITOR_REGISTRY } from '../model/editorConfig';
import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { createGroupIdFromName, createGroupSpec, getNextFormationName } from './behaviorCommands';
import { removeSceneGraphItem } from './sceneGraphCommands';
import { createAttachment, moveAttachmentWithinTarget, removeAttachment, updateAttachment } from './attachmentCommands';
import type { AttachmentSpec, TargetRef } from '../model/types';

export const PROJECT_STORAGE_KEY = 'phaseractions.projectYaml.v1';
export const SCENE_STORAGE_KEY_V1 = 'phaseractions.sceneYaml.v1';
export const SCENE_STORAGE_KEY = 'phaseractions.sceneYaml.v2';
export const STARTUP_MODE_STORAGE_KEY = 'phaseractions.startupMode.v1';
export const THEME_MODE_STORAGE_KEY = 'phaseractions.themeMode.v1';
export const UI_SCALE_STORAGE_KEY = 'phaseractions.uiScale.v1';
export const DEFAULT_UI_SCALE = 0.95;

export type ThemeMode = 'system' | 'light' | 'dark';

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
  | { kind: 'attachment'; id: Id };

export interface EditorState {
  project: ProjectSpec;
  currentSceneId: Id;
  selection: Selection;
  expandedGroups: Record<Id, boolean>;
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
  | { type: 'select'; selection: Selection }
  | { type: 'select-multiple'; entityIds: Id[]; additive: boolean }
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
  | { type: 'remove-entity-from-group'; groupId: Id; entityId: Id }
  | { type: 'dissolve-group'; id: Id }
  | { type: 'remove-scene-graph-item'; item: { kind: 'entity' | 'group' | 'attachment'; id: Id } }
  | { type: 'toggle-mode' }
  | { type: 'dismiss-view-hint' };

function defaultExpandedGroups(scene: SceneSpec): Record<Id, boolean> {
  return Object.fromEntries(Object.keys(scene.groups).map((groupId) => [groupId, false]));
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
    expandedGroups: defaultExpandedGroups(scene),
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

function withScene(state: EditorState, scene: GameSceneSpec, dirty: boolean, selection: Selection = state.selection): EditorState {
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
    expandedGroups: defaultExpandedGroups(scene),
    dirty,
    error: undefined,
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

export function reducer(state: EditorState, action: EditorAction): EditorState {
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
          expandedGroups: defaultExpandedGroups(activeScene),
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
      return withScene(
        {
          ...state,
          selection: { kind: 'none' },
        },
        createEmptyGameScene(state.currentSceneId),
        false,
        { kind: 'none' },
      );
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
      const project: ProjectSpec = {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [nextId]: cloned,
        },
      };
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
      const project: ProjectSpec = {
        ...state.project,
        scenes: remaining,
        initialSceneId: nextInitial,
      };
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
      const project: ProjectSpec = {
        ...state.project,
        scenes,
        initialSceneId: state.project.initialSceneId === action.sceneId ? nextId : state.project.initialSceneId,
      };
      return {
        ...state,
        project,
        currentSceneId: state.currentSceneId === action.sceneId ? nextId : state.currentSceneId,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(renamed),
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

      const groupId = `g-${Date.now()}`;
      const newGroup = createGroupSpec(groupId, state.selection.ids, action.name.trim() || getNextFormationName(scene));

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
        ...withScene(state, removed.scene as GameSceneSpec, true, { kind: 'entities', ids: group.members }),
        selection: { kind: 'entities', ids: group.members },
        expandedGroups,
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
        ...withScene(state, removed.scene as GameSceneSpec, true, { kind: 'entities', ids: group.members }),
        selection: { kind: 'entities', ids: group.members },
        expandedGroups,
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
      return {
        ...withScene(state, nextScene as GameSceneSpec, true, groupStillExists ? { kind: 'group', id: action.groupId } : { kind: 'entity', id: action.entityId }),
        selection: groupStillExists ? { kind: 'group', id: action.groupId } : { kind: 'entity', id: action.entityId },
        expandedGroups: defaultExpandedGroups(nextScene),
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
        expandedGroups: defaultExpandedGroups(nextScene),
      };
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
