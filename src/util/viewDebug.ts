const VIEW_DEBUG_FLAG_KEY = 'phaserforge.debugViewRestore.v1';
const VIEW_DEBUG_LOG_KEY = 'phaserforge.debugViewRestoreLog.v1';

export type ViewDebugBridge = {
  clear: () => void;
  disable: () => void;
  enable: () => void;
  read: () => unknown[];
};

declare global {
  interface Window {
    __PHASER_FORGE_VIEW_DEBUG__?: ViewDebugBridge;
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

export function setViewDebugEnabled(enabled: boolean) {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  if (enabled) storage.setItem(VIEW_DEBUG_FLAG_KEY, '1');
  else storage.removeItem(VIEW_DEBUG_FLAG_KEY);
}

export function isViewDebugEnabled(): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) return false;
  return storage.getItem(VIEW_DEBUG_FLAG_KEY) === '1';
}

export function clearViewDebugEntries() {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  storage.removeItem(VIEW_DEBUG_LOG_KEY);
}

export function readViewDebugEntries(): unknown[] {
  const storage = getSafeLocalStorage();
  if (!storage) return [];
  const raw = storage.getItem(VIEW_DEBUG_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function installViewDebugBridge() {
  if (typeof window === 'undefined' || window.__PHASER_FORGE_VIEW_DEBUG__) return;
  window.__PHASER_FORGE_VIEW_DEBUG__ = {
    clear: clearViewDebugEntries,
    disable: () => setViewDebugEnabled(false),
    enable: () => setViewDebugEnabled(true),
    read: readViewDebugEntries,
  };
}
