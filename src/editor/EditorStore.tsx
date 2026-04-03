import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { SceneSpec, ActionSpec, ConditionSpec, Id } from '../model/types';
import { sampleScene } from '../model/sampleScene';
import { validateSceneSpec } from '../model/validation';

const STORAGE_KEY = 'phaseractions.sceneSpec.v1';

export type Selection =
  | { kind: 'none' }
  | { kind: 'entity'; id: Id }
  | { kind: 'group'; id: Id }
  | { kind: 'behavior'; id: Id }
  | { kind: 'action'; id: Id }
  | { kind: 'condition'; id: Id };

export interface EditorState {
  scene: SceneSpec;
  selection: Selection;
  dirty: boolean;
  jsonText: string;
  error?: string;
}

type EditorAction =
  | { type: 'select'; selection: Selection }
  | { type: 'set-json-text'; value: string }
  | { type: 'export-json' }
  | { type: 'load-json' }
  | { type: 'reset-scene' }
  | { type: 'set-scene'; scene: SceneSpec }
  | { type: 'update-action'; id: Id; next: ActionSpec }
  | { type: 'update-condition'; id: Id; next: ConditionSpec };

const EditorContext = createContext<{
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
} | null>(null);

function initState(): EditorState {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SceneSpec;
        validateSceneSpec(parsed);
        return {
          scene: parsed,
          selection: { kind: 'behavior', id: Object.keys(parsed.behaviors)[0] ?? '' },
          dirty: false,
          jsonText: '',
        };
      } catch {
        // fall through to sample scene
      }
    }
  }
  return {
    scene: sampleScene,
    selection: { kind: 'behavior', id: 'b-formation' },
    dirty: false,
    jsonText: '',
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
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
    default:
      return state;
  }
}

export function EditorProvider({ children }: { children: React.ReactNode }): JSX.Element {
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
