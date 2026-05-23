export function buildZigzagOffset(opts: { width: number; height: number; segments: number }) {
  const width = Number(opts.width ?? 0);
  const height = Number(opts.height ?? 0);
  const segments = Number(opts.segments ?? 0);

  if (!Number.isFinite(segments) || segments <= 0) {
    throw new Error('segments must be > 0');
  }

  return (t: number): [number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    const segF = clamped * segments;
    let segIdx = Math.floor(segF);
    let segT = 0;
    if (segIdx >= segments) {
      segIdx = segments - 1;
      segT = 1;
    } else {
      segT = segF - segIdx;
    }

    let dx = 0;
    let dy = 0;
    for (let i = 0; i < segIdx; i += 1) {
      const direction = i % 2 === 0 ? 1 : -1;
      dx += width * direction;
      dy += height;
    }

    const direction = segIdx % 2 === 0 ? 1 : -1;
    dx += width * direction * segT;
    dy += height * segT;
    return [dx, dy];
  };
}

export function estimateZigzagDurationMs(opts: { width: number; height: number; segments: number; velocity: number }): number {
  const width = Number(opts.width ?? 0);
  const height = Number(opts.height ?? 0);
  const segments = Number(opts.segments ?? 0);
  const velocity = Number(opts.velocity ?? 0);
  if (!Number.isFinite(segments) || segments <= 0) return 0;
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const segmentDistance = Math.hypot(width, height);
  const totalDistance = Math.abs(segmentDistance * segments);
  return (totalDistance / velocity) * 1000;
}

export function buildWaveOffset(opts: {
  amplitude: number;
  length: number;
  startProgress?: number;
  endProgress?: number;
}) {
  const amplitude = Number(opts.amplitude ?? 0);
  const length = Number(opts.length ?? 0);
  const startProgress = Number(opts.startProgress ?? 0);
  const endProgress = Number(opts.endProgress ?? 1);

  if (startProgress < 0 || startProgress > 1 || endProgress < 0 || endProgress > 1) {
    throw new Error('start_progress and end_progress must be within [0.0, 1.0]');
  }
  if (endProgress < startProgress) {
    throw new Error('end_progress must be >= start_progress (no wrap or reverse supported)');
  }

  const span = endProgress - startProgress;
	  const fullOffset = (p: number): [number, number] => {
	    const tri = 1 - Math.abs(1 - 2 * p);
	    const dx = length * tri;
	    const dy = amplitude * Math.sin(Math.PI * tri);
	    return [dx, dy];
	  };

  const [baseDx, baseDy] = fullOffset(startProgress);

  return (t: number): [number, number] => {
    if (span === 0) return [0, 0];
    const clamped = Math.max(0, Math.min(1, t));
    const p = startProgress + span * clamped;
    const [dx, dy] = fullOffset(p);

    if (startProgress <= 1e-6 && endProgress >= 0.999 && clamped >= 0.999) {
      return [0, 0];
    }
    return [dx - baseDx, dy - baseDy];
  };
}

export function estimateWaveDurationMs(opts: { length: number; startProgress?: number; endProgress?: number; velocity: number }): number {
  const length = Math.abs(Number(opts.length ?? 0));
  const velocity = Number(opts.velocity ?? 0);
  const startProgress = Number(opts.startProgress ?? 0);
  const endProgress = Number(opts.endProgress ?? 1);
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const span = Math.max(0, Math.min(1, endProgress) - Math.max(0, Math.min(1, startProgress)));
  const fullDistance = 2.5 * length;
  return (fullDistance * span / velocity) * 1000;
}

export function buildSpiralOffset(opts: { maxRadius: number; revolutions: number; direction: 'outward' | 'inward' }) {
  const maxRadius = Number(opts.maxRadius ?? 0);
  const revolutions = Number(opts.revolutions ?? 0);
  const direction = opts.direction === 'inward' ? 'inward' : 'outward';

  return (t: number): [number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    const r = direction === 'inward' ? (1 - clamped) * maxRadius : clamped * maxRadius;
    const angle = clamped * revolutions * 2 * Math.PI;
    return [r * Math.cos(angle), r * Math.sin(angle)];
  };
}

export function estimateSpiralDurationMs(opts: { maxRadius: number; revolutions: number; velocity: number }): number {
  const maxRadius = Math.abs(Number(opts.maxRadius ?? 0));
  const revolutions = Math.abs(Number(opts.revolutions ?? 0));
  const velocity = Number(opts.velocity ?? 0);
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const totalLength = revolutions * Math.PI * maxRadius;
  return (totalLength / velocity) * 1000;
}

export function buildFigureEightOffset(opts: { width: number; height: number; includeControlPoints?: boolean }): {
  offsetFn: (t: number) => [number, number];
  controlPoints?: Array<[number, number]>;
} {
  const width = Number(opts.width ?? 0);
  const height = Number(opts.height ?? 0);

  const offsetFn = (t: number): [number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    const theta = clamped * 2 * Math.PI;
    const dx = (width / 2) * Math.sin(theta);
    const dy = (height / 2) * Math.sin(2 * theta);
    return [dx, dy];
  };

  if (!opts.includeControlPoints) return { offsetFn };

  const controlPoints: Array<[number, number]> = [];
  const numPoints = 16;
  for (let i = 0; i <= numPoints; i += 1) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const dx = (width / 2) * Math.sin(theta);
    const dy = (height / 2) * Math.sin(2 * theta);
    controlPoints.push([dx, dy]);
  }
  return { offsetFn, controlPoints };
}

export function estimateFigureEightDurationMs(opts: { width: number; height: number; velocity: number }): number {
  const width = Math.abs(Number(opts.width ?? 0));
  const height = Math.abs(Number(opts.height ?? 0));
  const velocity = Number(opts.velocity ?? 0);
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const pathLength = Math.PI * Math.max(width, height);
  return (pathLength / velocity) * 1000;
}

export function buildOrbitOffset(opts: { radius: number; clockwise: boolean; startAngleRad: number }) {
  const radius = Number(opts.radius ?? 0);
  const clockwise = Boolean(opts.clockwise);
  const startAngle = Number(opts.startAngleRad ?? 0);
  const dir = clockwise ? 1 : -1;

  return (t: number): [number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    const angle = startAngle + dir * clamped * 2 * Math.PI;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const startX = radius * Math.cos(startAngle);
    const startY = radius * Math.sin(startAngle);
    return [x - startX, y - startY];
  };
}

export function estimateOrbitDurationMs(opts: { radius: number; velocity: number }): number {
  const radius = Math.abs(Number(opts.radius ?? 0));
  const velocity = Number(opts.velocity ?? 0);
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const circumference = 2 * Math.PI * radius;
  return (circumference / velocity) * 1000;
}
