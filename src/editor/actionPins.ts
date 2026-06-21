import { projectPersistence } from './projectPersistence';

let cachedPinnedActionTypes: string[] = [];

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function normalize(types: string[]): string[] {
  const unique = Array.from(new Set(types.filter((x) => typeof x === 'string' && x.length > 0)));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

export function loadPinnedActionTypes(): string[] {
  if (!hasWindow()) return [];
  return cachedPinnedActionTypes.slice();
}

export async function loadPinnedActionTypesFromPersistence(): Promise<string[]> {
  const preferences = await projectPersistence.loadPreferencesRecord();
  cachedPinnedActionTypes = normalize(preferences?.pinnedActionTypes ?? []);
  return loadPinnedActionTypes();
}

export async function savePinnedActionTypes(types: string[]): Promise<string[]> {
  if (!hasWindow()) return [];
  cachedPinnedActionTypes = normalize(types);
  await projectPersistence.updatePreferencesRecord({
    pinnedActionTypes: cachedPinnedActionTypes,
  });
  return loadPinnedActionTypes();
}

export async function togglePinnedActionType(type: string): Promise<string[]> {
  if (!hasWindow()) return [];
  const set = new Set(loadPinnedActionTypes());
  if (set.has(type)) set.delete(type);
  else if (typeof type === 'string' && type.length > 0) set.add(type);
  return savePinnedActionTypes(Array.from(set));
}
