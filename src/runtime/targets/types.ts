export interface RuntimeEntity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hitbox?: { x: number; y: number; width: number; height: number };
  rotationDeg?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  visible?: boolean;
  depth?: number;
  flipX?: boolean;
  flipY?: boolean;
  asset?: unknown;
  homeX?: number;
  homeY?: number;
  vx?: number;
  vy?: number;
  adapter?: unknown;
}

export interface GroupBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface FormationGroup {
  id: string;
  members: RuntimeEntity[];
  homeSlots: Record<string, { x: number; y: number }>;
  getBounds(): GroupBounds;
  getHomeBounds(): GroupBounds;
  translate(dx: number, dy: number): void;
  setPosition(x: number, y: number): void;
  setVelocity(vx: number, vy: number): void;
  stopVelocity(axis?: 'x' | 'y'): void;
  forEachMember(fn: (member: RuntimeEntity) => void): void;
  getMember(entityId: string): RuntimeEntity | undefined;
}

export type RuntimeGroup = FormationGroup;

export type RuntimeTarget = RuntimeEntity | FormationGroup;
