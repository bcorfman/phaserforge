export type CameraLike = {
  x: number;
  y: number;
  scrollX: number;
  scrollY: number;
  zoomX: number;
  zoomY: number;
  originX: number;
  originY: number;
};

export type PointLike = { x: number; y: number };

export function worldToScreen(point: PointLike, camera: CameraLike): PointLike {
  return {
    x: (point.x - camera.scrollX - camera.originX) * camera.zoomX + camera.originX + camera.x,
    y: (point.y - camera.scrollY - camera.originY) * camera.zoomY + camera.originY + camera.y,
  };
}
