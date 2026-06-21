import { projectPersistence } from './projectPersistence';

let cachedPinnedPatternIds: string[] = [];

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function normalize(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

export function loadPinnedPatternIds(): string[] {
  if (!hasWindow()) return [];
  return cachedPinnedPatternIds.slice();
}

export async function loadPinnedPatternIdsFromPersistence(): Promise<string[]> {
  const preferences = await projectPersistence.loadPreferencesRecord();
  cachedPinnedPatternIds = normalize(preferences?.pinnedPatternIds ?? []);
  return loadPinnedPatternIds();
}

export async function savePinnedPatternIds(ids: string[]): Promise<string[]> {
  if (!hasWindow()) return [];
  cachedPinnedPatternIds = normalize(ids);
  await projectPersistence.updatePreferencesRecord({
    pinnedPatternIds: cachedPinnedPatternIds,
  });
  return loadPinnedPatternIds();
}

export async function togglePinnedPatternId(id: string): Promise<string[]> {
  if (!hasWindow()) return [];
  const set = new Set(loadPinnedPatternIds());
  if (set.has(id)) set.delete(id);
  else if (typeof id === 'string' && id.length > 0) set.add(id);
  return savePinnedPatternIds(Array.from(set));
}
