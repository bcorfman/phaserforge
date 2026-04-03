import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { SceneSpec, ActionSpec, ConditionSpec, GroupSpec, Id } from '../model/types';
import { sampleScene } from '../model/sampleScene';
import { validateSceneSpec } from '../model/validation';
import { applyGroupGridLayout, type GroupGridLayout } from './formationLayout';

const STORAGE_KEY = 'phaseractions.sceneSpec.v1';

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
  jsonText: string;
  error?: string;
  interaction?: { kind: 'entity' | 'group' | 'bounds'; id: string; handle?: 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' };
  mode: 'edit' | 'play';
}

type EditorAction =
  | { type: 'select'; selection: Selection }
  | { type: 'select-multiple'; entityIds: Id[]; additive: boolean }
  | { type: 'set-json-text'; value: string }
  | { type: 'export-json' }
  | { type: 'load-json' }
  | { type: 'reset-scene' }
  | { type: 'set-scene'; scene: SceneSpec }
  | { type: 'update-action'; id: Id; next: ActionSpec }
  | { type: 'update-condition'; id: Id; next: ConditionSpec }
  | { type: 'update-group'; id: Id; next: GroupSpec }
  | { type: 'toggle-group-expanded'; id: Id }
  | { type: 'move-entity'; id: Id; dx: number; dy: number }
  | { type: 'move-entities'; entityIds: Id[]; dx: number; dy: number }
  | { type: 'arrange-group-grid'; id: Id; layout: GroupGridLayout }
  | { type: 'update-bounds'; id: Id; bounds: { minX: number; maxX: number; minY: number; maxY: number } }
  | { type: 'begin-canvas-interaction'; kind: 'entity' | 'group' | 'bounds'; id: string; handle?: string }
  | { type: 'end-canvas-interaction' }
  | { type: 'create-group-from-selection'; name: string }
  | { type: 'dissolve-group'; id: Id }
  | { type: 'toggle-mode' };

function defaultExpandedGroups(scene: SceneSpec): Record<Id, boolean> {
  return Object.fromEntries(Object.keys(scene.groups).map((groupId) => [groupId, false]));
}

const EditorContext = createContext<{
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
} | null>(null);

export function initState(): EditorState {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SceneSpec;
        validateSceneSpec(parsed);
        return {
          scene: parsed,
          selection: { kind: 'behavior', id: Object.keys(parsed.behaviors)[0] ?? '' },
          expandedGroups: defaultExpandedGroups(parsed),
          dirty: false,
          jsonText: '',
          mode: 'edit',
        };
      } catch {
        // fall through to sample scene
      }
    }
  }
  return {
    scene: sampleScene,
    selection: { kind: 'behavior', id: 'b-formation' },
    expandedGroups: defaultExpandedGroups(sampleScene),
    dirty: false,
    jsonText: '',
    mode: 'edit',
  };
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: action.selection, error: undefined };
    case 'set-json-text':
      return { ...state, jsonText: action.value };
    case 'export-json':
      return { ...state, jsonText: JSON.stringify(state.scene, null, 2), error: undefined };
    case 'load-json': {
      try {
        const parsed = JSON.parse(state.jsonText) as SceneSpec;
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
        return { ...state, error: err instanceof Error ? err.message : 'Invalid JSON' };
      }
    }
    case 'reset-scene':
      return {
        ...state,
        scene: sampleScene,
        expandedGroups: defaultExpandedGroups(sampleScene),
        dirty: false,
        error: undefined,
        selection: { kind: 'behavior', id: 'b-formation' },
      };
    case 'set-scene':
      return { ...state, scene: action.scene, dirty: true };
    case 'update-action': {
      if (!state.scene.actions[action.id]) return state;
      return {
        ...state,
        scene: {
          ...state.scene,
          actions: {
            ...state.scene.actions,
            [action.id]: action.next,
          },
        },
        dirty: true,
        error: undefined,
      };
    }
    case 'update-condition': {
      if (!state.scene.conditions[action.id]) return state;
      return {
        ...state,
        scene: {
          ...state.scene,
          conditions: {
            ...state.scene.conditions,
            [action.id]: action.next,
          },
        },
        dirty: true,
        error: undefined,
      };
    }
    case 'update-group': {
      if (!state.scene.groups[action.id]) return state;
      return {
        ...state,
        scene: {
          ...state.scene,
          groups: {
            ...state.scene.groups,
            [action.id]: action.next,
          },
        },
        dirty: true,
        error: undefined,
      };
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
      return {
        ...state,
        scene: {
          ...state.scene,
          entities: {
            ...state.scene.entities,
            [action.id]: {
              ...entity,
              x: entity.x + action.dx,
              y: entity.y + action.dy,
            },
          },
        },
        dirty: true,
        error: undefined,
      };
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
      return {
        ...state,
        scene: {
          ...state.scene,
          entities: updatedEntities,
        },
        dirty: true,
        error: undefined,
      };
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
      return {
        ...state,
        scene: {
          ...state.scene,
          entities: updatedEntities,
        },
        dirty: true,
        error: undefined,
      };
    }
    case 'arrange-group-grid': {
      const nextScene = applyGroupGridLayout(state.scene, action.id, action.layout);
      if (nextScene === state.scene) return state;
      return {
        ...state,
        scene: nextScene,
        dirty: true,
        error: undefined,
      };
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
      return {
        ...state,
        scene: {
          ...state.scene,
          conditions: {
            ...state.scene.conditions,
            [action.id]: {
              ...condition,
              bounds: clampedBounds,
            },
          },
        },
        dirty: true,
        error: undefined,
      };
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

      const groupId = `g-${Date.now()}`; // Simple ID generation
      const newGroup = {
        id: groupId,
        name: action.name,
        members: state.selection.ids,
      };

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
    case 'dissolve-group': {
      const group = state.scene.groups[action.id];
      if (!group) return state;

      const { [action.id]: removedGroup, ...remainingGroups } = state.scene.groups;
      const { [action.id]: removedExpanded, ...remainingExpanded } = state.expandedGroups;

      return {
        ...state,
        scene: {
          ...state.scene,
          groups: remainingGroups,
        },
        selection: { kind: 'entities', ids: group.members },
        expandedGroups: remainingExpanded,
        dirty: true,
        error: undefined,
      };
    }
    case 'toggle-mode':
      return {
        ...state,
        mode: state.mode === 'edit' ? 'play' : 'edit',
      };
    default:
      return state;
  }
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scene));
    } catch {
      // ignore storage errors
    }
  }, [state.scene]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): { state: EditorState; dispatch: React.Dispatch<EditorAction> } {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorStore not found');
  return ctx;
}
