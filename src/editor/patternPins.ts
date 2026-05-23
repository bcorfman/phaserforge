const STORAGE_KEY = 'phaserforge.pinnedPatternIds.v1';

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPinnedPatternIds(): string[] {
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

export function savePinnedPatternIds(ids: string[]): void {
  if (!hasWindow()) return;
  try {
    const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
    unique.sort((a, b) => a.localeCompare(b));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

export function togglePinnedPatternId(id: string): string[] {
  const current = loadPinnedPatternIds();
  const set = new Set(current);
  if (set.has(id)) set.delete(id);
  else if (typeof id === 'string' && id.length > 0) set.add(id);
  const next = Array.from(set);
  next.sort((a, b) => a.localeCompare(b));
  savePinnedPatternIds(next);
  return next;
}

