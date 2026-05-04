export function clampPositive(value: number, min = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

export function percentFromScale(scale: number): number {
  if (!Number.isFinite(scale)) return 100;
  return scale * 100;
}

export function scaleFromPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  return percent / 100;
}

export function displayPixelsFromBaseAndScale(basePx: number, scale: number): number {
  return clampPositive(Math.round(basePx * scale), 1);
}

export function scaleFromDisplayPixels(basePx: number, displayPx: number): number {
  const safeBase = clampPositive(basePx, 1);
  const safeDisplay = clampPositive(displayPx, 1);
  return safeDisplay / safeBase;
}

export function maintainAspectDisplayHeight(baseWidth: number, baseHeight: number, displayWidth: number): number {
  const w = clampPositive(baseWidth, 1);
  const h = clampPositive(baseHeight, 1);
  return clampPositive(Math.round((displayWidth * h) / w), 1);
}

export function maintainAspectDisplayWidth(baseWidth: number, baseHeight: number, displayHeight: number): number {
  const w = clampPositive(baseWidth, 1);
  const h = clampPositive(baseHeight, 1);
  return clampPositive(Math.round((displayHeight * w) / h), 1);
}

