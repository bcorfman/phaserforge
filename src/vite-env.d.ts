/// <reference types="vite/client" />

interface PhaserActionsStudioTestBridge {
  isEnabled: boolean;
  clearStoredScene(): void;
  getState(): unknown;
  isSceneReady(): boolean;
  getSceneSnapshot(): unknown;
  getEntityWorldRect(id: string): unknown;
  getEntitySpriteWorldRect(id: string): unknown;
  getGroupWorldBounds(id: string): unknown;
  getEditableBoundsRect(): unknown;
  worldToClient(point: { x: number; y: number }): unknown;
  tapWorld(point: { x: number; y: number }): void;
  dragWorld(start: { x: number; y: number }, end: { x: number; y: number }): void;
  dragBoundsHandle(handle: string, delta: { x: number; y: number }): void;
  panByScreenDelta(delta: { x: number; y: number }): void;
  undo(): void;
  redo(): void;
  select(selection: unknown): void;
}

interface Window {
  __PHASER_ACTIONS_STUDIO_TEST__?: PhaserActionsStudioTestBridge;
}
