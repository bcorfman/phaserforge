export type PointerModifierKey = 'altKey' | 'shiftKey';

export function resolvePointerModifier(pointerEvent: unknown, key: PointerModifierKey, fallback: boolean): boolean {
  if (!pointerEvent || typeof pointerEvent !== 'object') return fallback;
  if (!(key in (pointerEvent as any))) return fallback;
  return Boolean((pointerEvent as any)[key]);
}

