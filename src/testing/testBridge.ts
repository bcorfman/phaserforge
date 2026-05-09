import type { Selection } from '../editor/EditorStore';
import type { ProjectSpec, SceneSpec, StartupMode } from '../model/types';
import { PROJECT_STORAGE_KEY, SCENE_STORAGE_KEY } from '../editor/EditorStore';

type Point = { x: number; y: number };
type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export interface AppStateSnapshot {
  project: ProjectSpec;
  currentSceneId: string;
  scene: SceneSpec; // active scene snapshot for convenience
  selection: Selection;
  mode: 'edit' | 'play';
  dirty: boolean;
  yamlText: string;
  error?: string;
  hasSeenViewHint: boolean;
  startupMode: StartupMode;
  initialized: boolean;
}

export interface SceneBridge {
  getTestSnapshot(): {
    ready: boolean;
    isActive?: boolean;
    sceneKey?: string;
    compiledSceneId?: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    backgroundLayerCount?: number;
  };
  getEntityWorldRect(id: string): (Rect & { centerX: number; centerY: number }) | null;
  getEntitySpriteWorldRect(id: string): (Rect & { centerX: number; centerY: number }) | null;
  getGroupWorldBounds(id: string): Rect | null;
  getGroupFrameVisible(id: string): boolean | null;
  getGroupLabelVisible(id: string): boolean | null;
  getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null;
  getEditableBoundsRect(): Rect | null;
  getHitboxOverlayInfo(): { visible: boolean; labelX: number; labelY: number } | null;
  worldToClient(point: Point): Point | null;
  testSetPointerWorld(point: Point): void;
  testPointerDownEntity(entityId: string): void;
  testTapWorld(point: Point, options?: { additive?: boolean }): void;
  testDragWorld(start: Point, end: Point): void;
  testDuplicateEntities(entityIds: string[], delta: Point): void;
  testDragBoundsHandle(handle: string, delta: Point): void;
  testPanByScreenDelta(delta: Point): void;
}

function isBridgeEnabled(): boolean {
  return typeof window !== 'undefined' && import.meta.env.DEV;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

let appStateGetter: (() => AppStateSnapshot) | null = null;
const sceneGetters = new Set<() => SceneBridge | null>();
let selectionSetter: ((selection: Selection) => void) | null = null;
let undoHandler: (() => void) | null = null;
let redoHandler: (() => void) | null = null;
let resetSceneHandler: (() => void) | null = null;

function getPreferredSceneKey(mode: AppStateSnapshot['mode'] | undefined): string | null {
  if (mode === 'edit') return 'EditorScene';
  if (mode === 'play') return 'GameScene';
  return null;
}

function getSceneBridge(): SceneBridge | null {
  const snapshot = appStateGetter?.();
  const preferredKey = getPreferredSceneKey(snapshot?.mode);

  let firstNonNull: SceneBridge | null = null;
  let activeScene: SceneBridge | null = null;
  for (const getter of sceneGetters) {
    let scene: SceneBridge | null = null;
    try {
      scene = getter();
    } catch {
      scene = null;
    }
    if (!scene) continue;
    if (!firstNonNull) firstNonNull = scene;
    let testSnapshot: ReturnType<SceneBridge['getTestSnapshot']> | null = null;
    try {
      testSnapshot = scene.getTestSnapshot();
    } catch {
      testSnapshot = null;
    }
    if (testSnapshot?.isActive) {
      if (!activeScene) activeScene = scene;
      // If the active scene matches the preferred key, return immediately.
      if (preferredKey && testSnapshot?.sceneKey === preferredKey) return scene;
    }
    if (preferredKey && testSnapshot?.sceneKey === preferredKey) {
      // Prefer the mapped scene if nothing is marked active (fallback).
      if (!activeScene) activeScene = scene;
    }
  }

  return activeScene ?? firstNonNull;
}

function ensureBridge(): void {
  if (!isBridgeEnabled() || typeof window === 'undefined') return;

  window.__PHASER_ACTIONS_STUDIO_TEST__ = {
    isEnabled: true,
    clearStoredScene() {
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      window.localStorage.removeItem(SCENE_STORAGE_KEY);
    },
    getState() {
      return appStateGetter ? clone(appStateGetter()) : null;
    },
    isSceneReady() {
      const scene = getSceneBridge();
      const appState = appStateGetter?.();
      return Boolean(scene && appState?.initialized && scene.getTestSnapshot().ready);
    },
    getSceneSnapshot() {
      const scene = getSceneBridge();
      return scene ? clone(scene.getTestSnapshot()) : null;
    },
    getEntityWorldRect(id: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getEntityWorldRect(id)) : null;
    },
    getEntitySpriteWorldRect(id: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getEntitySpriteWorldRect(id)) : null;
    },
    getGroupWorldBounds(id: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getGroupWorldBounds(id)) : null;
    },
    getGroupFrameVisible(id: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getGroupFrameVisible(id)) : null;
    },
    getGroupLabelVisible(id: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getGroupLabelVisible(id)) : null;
    },
    getFormationPhysicsGroupInfo(groupId: string) {
      const scene = getSceneBridge();
      return scene ? clone(scene.getFormationPhysicsGroupInfo(groupId)) : null;
    },
    getEditableBoundsRect() {
      const scene = getSceneBridge();
      return scene ? clone(scene.getEditableBoundsRect()) : null;
    },
    getHitboxOverlayInfo() {
      const scene = getSceneBridge();
      return scene ? clone(scene.getHitboxOverlayInfo()) : null;
    },
    worldToClient(point: Point) {
      const scene = getSceneBridge();
      return scene ? clone(scene.worldToClient(point)) : null;
    },
    setPointerWorld(point: Point) {
      const scene = getSceneBridge();
      scene?.testSetPointerWorld(point);
    },
    pointerDownEntity(entityId: string) {
      const scene = getSceneBridge();
      scene?.testPointerDownEntity(entityId);
    },
    tapWorld(point: Point, options?: { additive?: boolean }) {
      const scene = getSceneBridge();
      (scene as any)?.testTapWorld(point, options);
    },
    dragWorld(start: Point, end: Point) {
      const scene = getSceneBridge();
      scene?.testDragWorld(start, end);
    },
    duplicateEntities(entityIds: string[], delta: Point) {
      const scene = getSceneBridge();
      scene?.testDuplicateEntities(entityIds, delta);
    },
    dragBoundsHandle(handle: string, delta: Point) {
      const scene = getSceneBridge();
      scene?.testDragBoundsHandle(handle, delta);
    },
    panByScreenDelta(delta: Point) {
      const scene = getSceneBridge();
      scene?.testPanByScreenDelta(delta);
    },
    undo() {
      undoHandler?.();
    },
    redo() {
      redoHandler?.();
    },
    resetScene() {
      resetSceneHandler?.();
    },
    select(selection: Selection) {
      selectionSetter?.(selection);
    },
  };
}

export function registerAppStateGetter(getter: () => AppStateSnapshot): void {
  appStateGetter = getter;
  ensureBridge();
}

export function getCurrentAppStateSnapshot(): AppStateSnapshot | null {
  return appStateGetter ? clone(appStateGetter()) : null;
}

export function unregisterAppStateGetter(getter: () => AppStateSnapshot): void {
  if (appStateGetter === getter) {
    appStateGetter = null;
  }
}

export function registerSceneGetter(getter: () => SceneBridge | null): void {
  sceneGetters.add(getter);
  ensureBridge();
}

export function unregisterSceneGetter(getter: () => SceneBridge | null): void {
  sceneGetters.delete(getter);
}

export function registerSelectionSetter(setter: (selection: Selection) => void): void {
  selectionSetter = setter;
  ensureBridge();
}

export function unregisterSelectionSetter(setter: (selection: Selection) => void): void {
  if (selectionSetter === setter) {
    selectionSetter = null;
  }
}

export function registerUndoRedoHandlers(handlers: { undo: () => void; redo: () => void }): void {
  undoHandler = handlers.undo;
  redoHandler = handlers.redo;
  ensureBridge();
}

export function unregisterUndoRedoHandlers(handlers: { undo: () => void; redo: () => void }): void {
  if (undoHandler === handlers.undo) undoHandler = null;
  if (redoHandler === handlers.redo) redoHandler = null;
}

export function registerResetSceneHandler(handler: () => void): void {
  resetSceneHandler = handler;
  ensureBridge();
}

export function unregisterResetSceneHandler(handler: () => void): void {
  if (resetSceneHandler === handler) resetSceneHandler = null;
}
