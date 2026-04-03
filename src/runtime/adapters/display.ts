import { RuntimeEntity } from '../targets/types';

export interface DisplayObjectAdapter {
  x: number;
  y: number;
}

export function createDisplayObjectAdapter(): DisplayObjectAdapter {
  return { x: 0, y: 0 };
}

export function syncEntityToDisplay(entity: RuntimeEntity, display: DisplayObjectAdapter): void {
  display.x = entity.x;
  display.y = entity.y;
}
