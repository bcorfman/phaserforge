import { serializeProjectToYaml } from '../model/serialization';
import type { ProjectSpec } from '../model/types';

const PERSISTENCE_DEBUG_FLAG_KEY = 'phaserforge.debugPersistence.v1';
const PERSISTENCE_DEBUG_LOG_KEY = 'phaserforge.debugPersistenceLog.v1';
const PERSISTENCE_DEBUG_MAX_ENTRIES = 200;

type PersistenceDebugPrimitive = string | number | boolean | null;
export type PersistenceDebugValue =
  | PersistenceDebugPrimitive
  | PersistenceDebugValue[]
  | { [key: string]: PersistenceDebugValue };

export type PersistenceDebugEntry = {
  timestamp: string;
  event: string;
  details?: Record<string, PersistenceDebugValue>;
};

export type PersistenceDebugBridge = {
  clear: () => void;
  disable: () => void;
  dump: () => PersistenceDebugEntry[];
  enable: () => void;
  isEnabled: () => boolean;
  read: () => PersistenceDebugEntry[];
};

declare global {
  interface Window {
    __PHASER_FORGE_PERSISTENCE_DEBUG__?: PersistenceDebugBridge;
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

function getSafeLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeDebugValue(value: unknown, depth: number = 0): PersistenceDebugValue {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return {
    name: value.name,
    message: value.message,
  };
  if (depth >= 4) return String(value);
  if (Array.isArray(value)) return value.map((entry) => normalizeDebugValue(entry, depth + 1));
  if (typeof value === 'object') {
    const normalized: Record<string, PersistenceDebugValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      normalized[key] = normalizeDebugValue(entry, depth + 1);
    }
    return normalized;
  }
  return String(value);
}

function parseStoredEntries(storage: StorageLike): PersistenceDebugEntry[] {
  const raw = storage.getItem(PERSISTENCE_DEBUG_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PersistenceDebugEntry => {
      if (!entry || typeof entry !== 'object') return false;
      return typeof (entry as PersistenceDebugEntry).timestamp === 'string'
        && typeof (entry as PersistenceDebugEntry).event === 'string';
    });
  } catch {
    return [];
  }
}

function writeStoredEntries(storage: StorageLike, entries: PersistenceDebugEntry[]) {
  storage.setItem(PERSISTENCE_DEBUG_LOG_KEY, JSON.stringify(entries));
}

export function setPersistenceDebugEnabled(enabled: boolean) {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  if (enabled) storage.setItem(PERSISTENCE_DEBUG_FLAG_KEY, '1');
  else storage.removeItem(PERSISTENCE_DEBUG_FLAG_KEY);
}

export function isPersistenceDebugEnabled(): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) return false;
  return storage.getItem(PERSISTENCE_DEBUG_FLAG_KEY) === '1';
}

export function isDebugUrlFlagEnabled(paramName: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(paramName) === '1';
  } catch {
    return false;
  }
}

let persistenceDebugPreparedFromUrl = false;

export function preparePersistenceDebugFromUrl(paramName: string = 'restoreDebug'): boolean {
  if (!isDebugUrlFlagEnabled(paramName)) return false;
  if (persistenceDebugPreparedFromUrl) return true;
  clearPersistenceDebugEntries();
  setPersistenceDebugEnabled(true);
  persistenceDebugPreparedFromUrl = true;
  return true;
}

export function clearPersistenceDebugEntries() {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  storage.removeItem(PERSISTENCE_DEBUG_LOG_KEY);
}

export function readPersistenceDebugEntries(): PersistenceDebugEntry[] {
  const storage = getSafeLocalStorage();
  if (!storage) return [];
  return parseStoredEntries(storage);
}

export function appendPersistenceDebugEntry(event: string, details?: Record<string, unknown>) {
  const storage = getSafeLocalStorage();
  if (!storage || storage.getItem(PERSISTENCE_DEBUG_FLAG_KEY) !== '1') return;

  const entry: PersistenceDebugEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...(details ? { details: normalizeDebugValue(details) as Record<string, PersistenceDebugValue> } : {}),
  };
  const entries = parseStoredEntries(storage);
  entries.push(entry);
  writeStoredEntries(storage, entries.slice(-PERSISTENCE_DEBUG_MAX_ENTRIES));
  console.info('[phaserforge:persistence-debug]', entry.timestamp, event, entry.details ?? {});
}

export function summarizeYamlForDebug(yaml: string): { yamlHash: string; yamlLength: number } {
  let hash = 0;
  for (let index = 0; index < yaml.length; index += 1) {
    hash = ((hash << 5) - hash + yaml.charCodeAt(index)) | 0;
  }
  return {
    yamlHash: (hash >>> 0).toString(16).padStart(8, '0'),
    yamlLength: yaml.length,
  };
}

export function summarizeProjectLoadForDebug(options: {
  sourceLabel: string;
  project: ProjectSpec;
  activeProjectId?: string | null;
  currentProjectId?: string | null;
}) {
  const yaml = serializeProjectToYaml(options.project);
  return {
    sourceLabel: options.sourceLabel,
    activeProjectId: options.activeProjectId ?? null,
    currentProjectId: options.currentProjectId ?? null,
    nextProjectId: options.project.id,
    nextTitle: options.project.title?.trim() || 'Untitled Project',
    ...summarizeYamlForDebug(yaml),
  };
}

export function installPersistenceDebugBridge() {
  if (typeof window === 'undefined' || window.__PHASER_FORGE_PERSISTENCE_DEBUG__) return;
  window.__PHASER_FORGE_PERSISTENCE_DEBUG__ = {
    clear: clearPersistenceDebugEntries,
    disable: () => setPersistenceDebugEnabled(false),
    dump: () => {
      const entries = readPersistenceDebugEntries();
      console.info('[phaserforge:persistence-debug:dump]', entries);
      return entries;
    },
    enable: () => setPersistenceDebugEnabled(true),
    isEnabled: isPersistenceDebugEnabled,
    read: readPersistenceDebugEntries,
  };
}
