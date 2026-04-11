import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  ActionSpec,
  ConditionSpec,
  EditorRegistryConfig,
  GroupSpec,
  Id,
  SceneSpec,
  StartupMode,
  type EntitySpec,
} from '../model/types';
import { createEmptyScene } from '../model/emptyScene';
import { validateSceneSpec } from '../model/validation';
import { applyGroupGridLayout, type GroupGridLayout } from './formationLayout';
import { dissolveGroup, removeEntityFromGroup, updateGroupLayoutPosition } from './groupCommands';
import { syncBoundsToWorldResize } from './worldBounds';
import { loadEditorConfig, loadEditorRegistry, coerceStartupMode, EMPTY_EDITOR_REGISTRY } from '../model/editorConfig';
import { parseSceneYaml, serializeSceneToYaml } from '../model/serialization';
import {
  appendActionToBehavior,
  assignBehaviorToTarget,
  createDefaultBehaviorForTarget,
  createGroupSpec,
  getNextFormationName,
  getPrimaryBehaviorForEntity,
  getPrimaryBehaviorForGroup,
  moveSequenceChild,
  removeBehavior,
  removeSequenceChild,
  renameBehavior,
} from './behaviorCommands';
import { removeSceneGraphItem } from './sceneGraphCommands';

export const SCENE_STORAGE_KEY = 'phaseractions.sceneYaml.v1';
export const STARTUP_MODE_STORAGE_KEY = 'phaseractions.startupMode.v1';

export type Selection =
  | { kind: 'none' }
  | { kind: 'entity'; id: Id }
  | { kind: 'entities'; ids: Id[] }
  | { kind: 'group'; id: Id }
  | { kind: 'behavior'; id: Id }
  | { kind: 'action'; id: Id }
  | { kind: 'condition'; id: Id };

export interface EditorState {
  scene: SceneSpec;
  selection: Selection;
  expandedGroups: Record<Id, boolean>;
  dirty: boolean;
  yamlText: string;
  error?: string;
  interaction?: { kind: 'entity' | 'group' | 'bounds'; id: string; handle?: 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' };
  mode: 'edit' | 'play';
  hasSeenViewHint: boolean;
  startupMode: StartupMode;
  registry: EditorRegistryConfig;
  initialized: boolean;
}

export type ImportedEntityDraft = {
  entity: EntitySpec;
  addToSelectedGroup?: boolean;
};

export type EditorAction =
  | { type: 'initialize'; scene: SceneSpec; startupMode: StartupMode; registry: EditorRegistryConfig }
  | { type: 'set-startup-mode'; startupMode: StartupMode }
  | { type: 'select'; selection: Selection }
  | { type: 'select-multiple'; entityIds: Id[]; additive: boolean }
  | { type: 'set-yaml-text'; value: string }
  | { type: 'export-yaml' }
  | { type: 'load-yaml' }
  | { type: 'reset-scene' }
  | { type: 'set-scene'; scene: SceneSpec }
  | { type: 'update-scene-world'; width: number; height: number }
  | { type: 'update-entity'; id: Id; next: EntitySpec }
  | { type: 'import-entities'; drafts: ImportedEntityDraft[] }
  | { type: 'update-action'; id: Id; next: ActionSpec }
  | { type: 'update-condition'; id: Id; next: ConditionSpec }
  | { type: 'update-group'; id: Id; next: GroupSpec }
  | { type: 'toggle-group-expanded'; id: Id }
  | { type: 'move-entity'; id: Id; dx: number; dy: number }
  | { type: 'move-group'; id: Id; dx: number; dy: number }
  | { type: 'move-entities'; entityIds: Id[]; dx: number; dy: number }
  | { type: 'arrange-group-grid'; id: Id; layout: GroupGridLayout }
  | { type: 'update-bounds'; id: Id; bounds: { minX: number; maxX: number; minY: number; maxY: number } }
  | { type: 'begin-canvas-interaction'; kind: 'entity' | 'group' | 'bounds'; id: string; handle?: string }
  | { type: 'end-canvas-interaction' }
  | { type: 'create-group-from-selection'; name: string }
  | { type: 'remove-entity-from-group'; groupId: Id; entityId: Id }
  | { type: 'dissolve-group'; id: Id }
  | { type: 'create-default-behavior-for-selection' }
  | { type: 'assign-existing-behavior-to-selection'; behaviorId: Id }
  | { type: 'rename-behavior'; id: Id; name: string }
  | { type: 'remove-behavior-from-selection' }
  | { type: 'append-action-to-selection-behavior'; actionType: 'MoveUntil' | 'Wait' | 'Call' }
  | { type: 'move-sequence-action'; sequenceId: Id; childId: Id; direction: 'up' | 'down' }
  | { type: 'remove-sequence-action'; sequenceId: Id; childId: Id }
  | { type: 'remove-scene-graph-item'; item: { kind: 'entity' | 'group' | 'behavior' | 'action' | 'condition'; id: Id } }
  | { type: 'toggle-mode' }
  | { type: 'dismiss-view-hint' };

function defaultExpandedGroups(scene: SceneSpec): Record<Id, boolean> {
  return Object.fromEntries(Object.keys(scene.groups).map((groupId) => [groupId, false]));
}

const EditorContext = createContext<{
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
} | null>(null);

function defaultState(): EditorState {
  const scene = createEmptyScene();
  return {
    scene,
    selection: { kind: 'none' },
    expandedGroups: defaultExpandedGroups(scene),
    dirty: false,
    yamlText: '',
    mode: 'edit',
    hasSeenViewHint: false,
    startupMode: 'reload_last_yaml',
    registry: EMPTY_EDITOR_REGISTRY,
    initialized: false,
  };
}

export function initState(): EditorState {
  return defaultState();
}

function withScene(state: EditorState, scene: SceneSpec, dirty: boolean, selection: Selection = state.selection): EditorState {
  return {
    ...state,
    scene,
    selection,
    expandedGroups: defaultExpandedGroups(scene),
    dirty,
    error: undefined,
  };
}

function importEntities(state: EditorState, drafts: ImportedEntityDraft[]): EditorState {
  if (drafts.length === 0) return state;
  const entities = { ...state.scene.entities };
  const groups = { ...state.scene.groups };
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
    ...state,
    scene: {
      ...state.scene,
      entities,
      groups,
    },
    selection: importedIds.length === 1 ? { kind: 'entity', id: importedIds[0] } : { kind: 'entities', ids: importedIds },
    dirty: true,
    error: undefined,
  };
}

function selectionToTarget(selection: Selection): { type: 'entity'; entityId: Id } | { type: 'group'; groupId: Id } | null {
  if (selection.kind === 'entity') return { type: 'entity', entityId: selection.id };
  if (selection.kind === 'group') return { type: 'group', groupId: selection.id };
  return null;
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'initialize':
      return {
        ...state,
        scene: action.scene,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(action.scene),
        dirty: false,
        error: undefined,
        startupMode: action.startupMode,
        registry: action.registry,
        initialized: true,
      };
    case 'set-startup-mode':
      return {
        ...state,
        startupMode: action.startupMode,
      };
    case 'select':
      return { ...state, selection: action.selection, error: undefined };
    case 'set-yaml-text':
      return { ...state, yamlText: action.value };
    case 'export-yaml':
      return { ...state, yamlText: serializeSceneToYaml(state.scene), error: undefined };
    case 'load-yaml': {
      try {
        const parsed = parseSceneYaml(state.yamlText);
        validateSceneSpec(parsed);
        return {
          ...state,
          scene: parsed,
          expandedGroups: defaultExpandedGroups(parsed),
          dirty: false,
          error: undefined,
          selection: { kind: 'none' },
        };
      } catch (err) {
        return { ...state, error: err instanceof Error ? err.message : 'Invalid YAML' };
      }
    }
    case 'reset-scene':
      return {
        ...state,
        scene: createEmptyScene(),
        expandedGroups: {},
        dirty: false,
        error: undefined,
        selection: { kind: 'none' },
      };
    case 'set-scene':
      return { ...state, scene: action.scene, dirty: true };
    case 'update-scene-world':
      return withScene(
        state,
        syncBoundsToWorldResize(state.scene, {
          width: Math.max(1, action.width),
          height: Math.max(1, action.height),
        }),
        true,
      );
    case 'update-entity': {
      if (!state.scene.entities[action.id]) return state;
      return withScene(state, {
        ...state.scene,
        entities: {
          ...state.scene.entities,
          [action.id]: action.next,
        },
      }, true);
    }
    case 'import-entities':
      return importEntities(state, action.drafts);
    case 'update-action': {
      if (!state.scene.actions[action.id]) return state;
      return withScene(state, {
        ...state.scene,
        actions: {
          ...state.scene.actions,
          [action.id]: action.next,
        },
      }, true);
    }
    case 'update-condition': {
      if (!state.scene.conditions[action.id]) return state;
      return withScene(state, {
        ...state.scene,
        conditions: {
          ...state.scene.conditions,
          [action.id]: action.next,
        },
      }, true);
    }
    case 'update-group': {
      if (!state.scene.groups[action.id]) return state;
      return withScene(state, {
        ...state.scene,
        groups: {
          ...state.scene.groups,
          [action.id]: action.next,
        },
      }, true);
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
      const entity = state.scene.entities[action.id];
      if (!entity) return state;
      return withScene(state, {
        ...state.scene,
        entities: {
          ...state.scene.entities,
          [action.id]: {
            ...entity,
            x: entity.x + action.dx,
            y: entity.y + action.dy,
          },
        },
      }, true);
    }
    case 'move-group': {
      const group = state.scene.groups[action.id];
      if (!group) return state;
      const updatedEntities = { ...state.scene.entities };
      for (const entityId of group.members) {
        const entity = updatedEntities[entityId];
        if (entity) {
          updatedEntities[entityId] = {
            ...entity,
            x: entity.x + action.dx,
            y: entity.y + action.dy,
          };
        }
      }
      return withScene(state, {
        ...state.scene,
        entities: updatedEntities,
        groups: {
          ...state.scene.groups,
          [action.id]: updateGroupLayoutPosition(group, action.dx, action.dy),
        },
      }, true);
    }
    case 'select-multiple':
      if (action.entityIds.length === 0) {
        return { ...state, selection: { kind: 'none' } };
      } else if (action.entityIds.length === 1) {
        return { ...state, selection: { kind: 'entity', id: action.entityIds[0] } };
      } else {
        return { ...state, selection: { kind: 'entities', ids: action.entityIds } };
      }
    case 'move-entities': {
      const updatedEntities = { ...state.scene.entities };
      for (const entityId of action.entityIds) {
        const entity = updatedEntities[entityId];
        if (entity) {
          updatedEntities[entityId] = {
            ...entity,
            x: entity.x + action.dx,
            y: entity.y + action.dy,
          };
        }
      }
      return withScene(state, {
        ...state.scene,
        entities: updatedEntities,
      }, true);
    }
    case 'arrange-group-grid': {
      const nextScene = applyGroupGridLayout(state.scene, action.id, action.layout);
      if (nextScene === state.scene) return state;
      return withScene(state, nextScene, true);
    }
    case 'update-bounds': {
      const condition = state.scene.conditions[action.id];
      if (!condition || condition.type !== 'BoundsHit') return state;
      const clampedBounds = {
        minX: Math.min(action.bounds.minX, action.bounds.maxX),
        maxX: Math.max(action.bounds.minX, action.bounds.maxX),
        minY: Math.min(action.bounds.minY, action.bounds.maxY),
        maxY: Math.max(action.bounds.minY, action.bounds.maxY),
      };
      return withScene(state, {
        ...state.scene,
        conditions: {
          ...state.scene.conditions,
          [action.id]: {
            ...condition,
            bounds: clampedBounds,
          },
        },
      }, true);
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

      const groupId = `g-${Date.now()}`;
      const newGroup = createGroupSpec(groupId, state.selection.ids, action.name.trim() || getNextFormationName(state.scene));

      return {
        ...state,
        scene: {
          ...state.scene,
          groups: {
            ...state.scene.groups,
            [groupId]: newGroup,
          },
        },
        selection: { kind: 'group', id: groupId },
        expandedGroups: {
          ...state.expandedGroups,
          [groupId]: true,
        },
        dirty: true,
        error: undefined,
      };
    }
    case 'create-default-behavior-for-selection': {
      const target = selectionToTarget(state.selection);
      if (!target) return state;
      const { scene } = createDefaultBehaviorForTarget(state.scene, target);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        dirty: true,
        error: undefined,
      };
    }
    case 'assign-existing-behavior-to-selection': {
      const target = selectionToTarget(state.selection);
      if (!target) return state;
      const scene = assignBehaviorToTarget(state.scene, action.behaviorId, target);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        dirty: true,
        error: undefined,
      };
    }
    case 'rename-behavior': {
      const scene = renameBehavior(state.scene, action.id, action.name);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        dirty: true,
        error: undefined,
      };
    }
    case 'remove-behavior-from-selection': {
      const target = selectionToTarget(state.selection);
      if (!target) return state;
      const behavior = target.type === 'entity'
        ? getPrimaryBehaviorForEntity(state.scene, target.entityId)
        : getPrimaryBehaviorForGroup(state.scene, target.groupId);
      if (!behavior) return state;
      return {
        ...state,
        scene: removeBehavior(state.scene, behavior.id),
        dirty: true,
        error: undefined,
      };
    }
    case 'append-action-to-selection-behavior': {
      const target = selectionToTarget(state.selection);
      if (!target) return state;
      const existingBehavior = target.type === 'entity'
        ? getPrimaryBehaviorForEntity(state.scene, target.entityId)
        : getPrimaryBehaviorForGroup(state.scene, target.groupId);
      const { scene: sceneWithBehavior, behaviorId } = existingBehavior
        ? { scene: state.scene, behaviorId: existingBehavior.id }
        : createDefaultBehaviorForTarget(state.scene, target);
      const { scene, actionId } = appendActionToBehavior(sceneWithBehavior, behaviorId, action.actionType);
      if (!actionId) return state;
      return {
        ...state,
        scene,
        selection: { kind: 'action', id: actionId },
        dirty: true,
        error: undefined,
      };
    }
    case 'move-sequence-action': {
      const scene = moveSequenceChild(state.scene, action.sequenceId, action.childId, action.direction);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        dirty: true,
        error: undefined,
      };
    }
    case 'remove-sequence-action': {
      const scene = removeSequenceChild(state.scene, action.sequenceId, action.childId);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        dirty: true,
        error: undefined,
      };
    }
    case 'remove-scene-graph-item': {
      const scene = removeSceneGraphItem(state.scene, action.item);
      if (scene === state.scene) return state;
      return {
        ...state,
        scene,
        selection: { kind: 'none' },
        expandedGroups: defaultExpandedGroups(scene),
        dirty: true,
        error: undefined,
      };
    }
    case 'remove-entity-from-group': {
      const nextScene = removeEntityFromGroup(state.scene, action.groupId, action.entityId);
      if (nextScene === state.scene) return state;
      const groupStillExists = Boolean(nextScene.groups[action.groupId]);
      return {
        ...state,
        scene: nextScene,
        selection: groupStillExists ? { kind: 'group', id: action.groupId } : { kind: 'entity', id: action.entityId },
        expandedGroups: defaultExpandedGroups(nextScene),
        dirty: true,
        error: undefined,
      };
    }
    case 'dissolve-group': {
      const group = state.scene.groups[action.id];
      if (!group) return state;
      const nextScene = dissolveGroup(state.scene, action.id);

      return {
        ...state,
        scene: nextScene,
        selection: { kind: 'entities', ids: group.members },
        expandedGroups: defaultExpandedGroups(nextScene),
        dirty: true,
        error: undefined,
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

function loadStoredSceneYaml(): SceneSpec | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = parseSceneYaml(raw);
    validateSceneSpec(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const [config, registry] = await Promise.all([loadEditorConfig(), loadEditorRegistry()]);
      if (cancelled) return;

      const storedMode = typeof window !== 'undefined'
        ? coerceStartupMode(window.localStorage.getItem(STARTUP_MODE_STORAGE_KEY), config.startupMode)
        : config.startupMode;
      const scene = storedMode === 'reload_last_yaml' ? (loadStoredSceneYaml() ?? createEmptyScene()) : createEmptyScene();

      dispatch({ type: 'initialize', scene, startupMode: storedMode, registry });
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
      window.localStorage.setItem(SCENE_STORAGE_KEY, serializeSceneToYaml(state.scene));
    } catch {
      // ignore storage errors
    }
  }, [state.initialized, state.scene]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): { state: EditorState; dispatch: React.Dispatch<EditorAction> } {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorStore not found');
  return ctx;
}
