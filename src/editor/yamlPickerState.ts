let lastStartInHandle: any | undefined;
let lastYamlFileHandle: any | undefined;
const YAML_FILE_SOURCE_LABEL_STORAGE_KEY = 'phaserforge:last-yaml-file-label';

function readStoredYamlFileSourceLabel(): string | undefined {
  if (typeof window === 'undefined' || !('localStorage' in window)) return undefined;
  try {
    const stored = window.localStorage.getItem(YAML_FILE_SOURCE_LABEL_STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredYamlFileSourceLabel(label: string | undefined): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) return;
  try {
    if (label && label.trim().length > 0) {
      window.localStorage.setItem(YAML_FILE_SOURCE_LABEL_STORAGE_KEY, label);
      return;
    }
    window.localStorage.removeItem(YAML_FILE_SOURCE_LABEL_STORAGE_KEY);
  } catch {
    // Ignore storage failures so file actions keep working in restricted environments.
  }
}

let lastYamlFileSourceLabel: string | undefined = readStoredYamlFileSourceLabel();

export function getYamlPickerStartIn(): any | undefined {
  return lastStartInHandle;
}

export function setYamlPickerStartIn(handle: any | undefined): void {
  lastStartInHandle = handle;
}

export function getYamlFileHandle(): any | undefined {
  return lastYamlFileHandle;
}

export function setYamlFileHandle(handle: any | undefined): void {
  lastYamlFileHandle = handle;
}

export function getYamlFileSourceLabel(): string | undefined {
  return lastYamlFileSourceLabel;
}

export function setYamlFileSourceLabel(label: string | undefined): void {
  lastYamlFileSourceLabel = label;
  writeStoredYamlFileSourceLabel(label);
}
