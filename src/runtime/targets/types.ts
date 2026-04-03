export interface RuntimeEntity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeGroup {
  id: string;
  members: RuntimeEntity[];
}

export type RuntimeTarget = RuntimeEntity | RuntimeGroup;
