import type { Selection } from '../editor/EditorStore';
import type { SceneSpec, StartupMode } from '../model/types';
import { SCENE_STORAGE_KEY } from '../editor/EditorStore';

type Point = { x: number; y: number };
type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export interface AppStateSnapshot {
  scene: SceneSpec;
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
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  getEntityWorldRect(id: string): (Rect & { centerX: number; centerY: number }) | null;
  getGroupWorldBounds(id: string): Rect | null;
  getEditableBoundsRect(): Rect | null;
  worldToClient(point: Point): Point | null;
  testTapWorld(point: Point): void;
  testDragWorld(start: Point, end: Point): void;
  testDragBoundsHandle(handle: string, delta: Point): void;
  testPanByScreenDelta(delta: Point): void;
  testUndo(): void;
  testRedo(): void;
}

function isBridgeEnabled(): boolean {
  return typeof window !== 'undefined' && import.meta.env.DEV;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

let appStateGetter: (() => AppStateSnapshot) | null = null;
let sceneGetter: (() => SceneBridge | null) | null = null;
let selectionSetter: ((selection: Selection) => void) | null = null;

function ensureBridge(): void {
  if (!isBridgeEnabled() || typeof window === 'undefined') return;

  window.__PHASER_ACTIONS_STUDIO_TEST__ = {
    isEnabled: true,
    clearStoredScene() {
      window.localStorage.removeItem(SCENE_STORAGE_KEY);
    },
    getState() {
      return appStateGetter ? clone(appStateGetter()) : null;
    },
    isSceneReady() {
      const scene = sceneGetter?.();
      const appState = appStateGetter?.();
      return Boolean(scene && appState?.initialized && scene.getTestSnapshot().ready);
    },
    getSceneSnapshot() {
      const scene = sceneGetter?.();
      return scene ? clone(scene.getTestSnapshot()) : null;
    },
    getEntityWorldRect(id: string) {
      const scene = sceneGetter?.();
      return scene ? clone(scene.getEntityWorldRect(id)) : null;
    },
    getGroupWorldBounds(id: string) {
      const scene = sceneGetter?.();
      return scene ? clone(scene.getGroupWorldBounds(id)) : null;
    },
    getEditableBoundsRect() {
      const scene = sceneGetter?.();
      return scene ? clone(scene.getEditableBoundsRect()) : null;
    },
    worldToClient(point: Point) {
      const scene = sceneGetter?.();
      return scene ? clone(scene.worldToClient(point)) : null;
    },
    tapWorld(point: Point) {
      const scene = sceneGetter?.();
      scene?.testTapWorld(point);
    },
    dragWorld(start: Point, end: Point) {
      const scene = sceneGetter?.();
      scene?.testDragWorld(start, end);
    },
    dragBoundsHandle(handle: string, delta: Point) {
      const scene = sceneGetter?.();
      scene?.testDragBoundsHandle(handle, delta);
    },
    panByScreenDelta(delta: Point) {
      const scene = sceneGetter?.();
      scene?.testPanByScreenDelta(delta);
    },
    undo() {
      const scene = sceneGetter?.();
      scene?.testUndo();
    },
    redo() {
      const scene = sceneGetter?.();
      scene?.testRedo();
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
  sceneGetter = getter;
  ensureBridge();
}

export function unregisterSceneGetter(getter: () => SceneBridge | null): void {
  if (sceneGetter === getter) {
    sceneGetter = null;
  }
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
