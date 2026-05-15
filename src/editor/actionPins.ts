const STORAGE_KEY = 'phaseractions.pinnedActionTypes.v1';

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPinnedActionTypes(): string[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = Array.from(new Set(parsed.filter((x) => typeof x === 'string' && x.length > 0)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  } catch {
    return [];
  }
}

export function savePinnedActionTypes(types: string[]): void {
  if (!hasWindow()) return;
  try {
    const unique = Array.from(new Set(types.filter((x) => typeof x === 'string' && x.length > 0)));
    unique.sort((a, b) => a.localeCompare(b));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

export function togglePinnedActionType(type: string): string[] {
  const current = loadPinnedActionTypes();
  const set = new Set(current);
  if (set.has(type)) set.delete(type);
  else if (typeof type === 'string' && type.length > 0) set.add(type);
  const next = Array.from(set);
  next.sort((a, b) => a.localeCompare(b));
  savePinnedActionTypes(next);
  return next;
}

