/// <reference types="vite/client" />

type PhaserForgePoint = { x: number; y: number };
type PhaserForgeRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX?: number;
  centerY?: number;
};

interface PhaserForgeTestBridge {
  isEnabled: boolean;
  forceCloudEnabled?: boolean;
  clearStoredScene(): void;
  getState(): unknown;
  reloadRuntime(): Promise<void>;
  dispatch(action: unknown): void;
  setMode(mode: 'edit' | 'play'): void;
  isSceneReady(): boolean;
  getSceneSnapshot(): unknown;
  getEntityWorldRect(id: string): PhaserForgeRect | null;
  getEntitySpriteWorldRect(id: string): PhaserForgeRect | null;
  getGroupWorldBounds(id: string): PhaserForgeRect | null;
  getGroupFrameVisible(id: string): boolean | null;
  getGroupLabelVisible(id: string): boolean | null;
  getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null;
  getEditableBoundsRect(): PhaserForgeRect | null;
  hitTestAtClientPoint(clientX: number, clientY: number): { kind: 'none' | 'entity' | 'group'; id?: string };
  worldToClient(point: PhaserForgePoint): PhaserForgePoint | null;
  setPointerWorld(point: PhaserForgePoint): void;
  pointerDownEntity(entityId: string): void;
  tapWorld(point: PhaserForgePoint, options?: { additive?: boolean }): void;
  dragWorld(start: PhaserForgePoint, end: PhaserForgePoint): void;
  duplicateEntities(entityIds: string[], delta: PhaserForgePoint): void;
  dragBoundsHandle(handle: string, delta: PhaserForgePoint): void;
  panByScreenDelta(delta: PhaserForgePoint): void;
  undo(): void;
  redo(): void;
  resetScene(): void;
  select(selection: unknown): void;
  pauseActiveProjectRecordPersistence(): void;
  resumeActiveProjectRecordPersistence(): void;
}

interface Window {
  __PHASER_FORGE_TEST__?: PhaserForgeTestBridge;
}
