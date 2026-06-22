import type { Selection } from '../editor/EditorStore';
import type { ProjectSpec, SceneSpec, StartupMode } from '../model/types';
import { SCENE_STORAGE_KEY } from '../editor/EditorStore';

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
    maxZoom?: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    worldWidth?: number;
    worldHeight?: number;
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
  hitTestAtClientPoint?(clientX: number, clientY: number): { kind: 'none' | 'entity' | 'group'; id?: string };
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
let actionDispatcher: ((action: unknown) => void) | null = null;
let toggleModeHandler: (() => void) | null = null;
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
  let readyPreferredScene: SceneBridge | null = null;
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
    if (preferredKey && testSnapshot?.sceneKey === preferredKey && testSnapshot?.ready) {
      readyPreferredScene = scene;
    }
    if (testSnapshot?.isActive) {
      if (!activeScene) activeScene = scene;
      // If the active scene matches the preferred key, return immediately.
      if (preferredKey && testSnapshot?.sceneKey === preferredKey && testSnapshot?.ready) return scene;
    }
    if (preferredKey && testSnapshot?.sceneKey === preferredKey) {
      // Prefer the mapped scene if nothing is marked active (fallback).
      if (!activeScene) activeScene = scene;
    }
  }

  if (readyPreferredScene) return readyPreferredScene;
  return activeScene ?? firstNonNull;
}

function ensureBridge(): void {
  if (!isBridgeEnabled() || typeof window === 'undefined') return;

  window.__PHASER_FORGE_TEST__ = {
    isEnabled: true,
    forceCloudEnabled: false,
    clearStoredScene() {
      window.localStorage.removeItem(SCENE_STORAGE_KEY);
    },
    getState() {
      return appStateGetter ? clone(appStateGetter()) : null;
    },
    async reloadRuntime() {
      const snapshot = appStateGetter?.();
      if (!snapshot) return;
      // Lazy import to avoid pulling Phaser into jsdom/Vitest runs.
      const { EventBus } = await import('../phaser/EventBus');
      EventBus.emit('runtime:load-project', snapshot.project, snapshot.currentSceneId, snapshot.mode);
    },
    dispatch(action: unknown) {
      actionDispatcher?.(action);
    },
    setMode(mode: 'edit' | 'play') {
      const current = appStateGetter?.()?.mode;
      if (!current || current === mode) return;
      // In case the handler triggers async state updates, keep this as a single toggle
      // and let tests poll `getState()` / `getSceneSnapshot()` for completion.
      toggleModeHandler?.();
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
    hitTestAtClientPoint(clientX: number, clientY: number) {
      const scene = getSceneBridge();
      return scene ? clone((scene as any)?.hitTestAtClientPoint?.(clientX, clientY) ?? { kind: 'none' }) : { kind: 'none' };
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

// Make the test bridge flag available as early as possible in DEV so E2E boot waits don't depend on
// React effects firing. The individual handlers/getters are still registered later.
ensureBridge();

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

export function registerActionDispatcher(dispatcher: (action: unknown) => void): void {
  actionDispatcher = dispatcher;
  ensureBridge();
}

export function unregisterActionDispatcher(dispatcher: (action: unknown) => void): void {
  if (actionDispatcher === dispatcher) {
    actionDispatcher = null;
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

export function registerModeToggleHandler(handler: () => void): void {
  toggleModeHandler = handler;
  ensureBridge();
}

export function unregisterModeToggleHandler(handler: () => void): void {
  if (toggleModeHandler === handler) toggleModeHandler = null;
}

export function registerResetSceneHandler(handler: () => void): void {
  resetSceneHandler = handler;
  ensureBridge();
}

export function unregisterResetSceneHandler(handler: () => void): void {
  if (resetSceneHandler === handler) resetSceneHandler = null;
}
