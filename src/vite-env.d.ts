/// <reference types="vite/client" />

type PhaserActionsStudioPoint = { x: number; y: number };
type PhaserActionsStudioRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX?: number;
  centerY?: number;
};

interface PhaserActionsStudioTestBridge {
  isEnabled: boolean;
  clearStoredScene(): void;
  getState(): unknown;
  isSceneReady(): boolean;
  getSceneSnapshot(): unknown;
  getEntityWorldRect(id: string): PhaserActionsStudioRect | null;
  getEntitySpriteWorldRect(id: string): PhaserActionsStudioRect | null;
  getGroupWorldBounds(id: string): PhaserActionsStudioRect | null;
  getGroupFrameVisible(id: string): boolean | null;
  getGroupLabelVisible(id: string): boolean | null;
  getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null;
  getEditableBoundsRect(): PhaserActionsStudioRect | null;
  worldToClient(point: PhaserActionsStudioPoint): PhaserActionsStudioPoint | null;
  tapWorld(point: PhaserActionsStudioPoint): void;
  dragWorld(start: PhaserActionsStudioPoint, end: PhaserActionsStudioPoint): void;
  dragBoundsHandle(handle: string, delta: PhaserActionsStudioPoint): void;
  panByScreenDelta(delta: PhaserActionsStudioPoint): void;
  undo(): void;
  redo(): void;
  select(selection: unknown): void;
}

interface Window {
  __PHASER_ACTIONS_STUDIO_TEST__?: PhaserActionsStudioTestBridge;
}
