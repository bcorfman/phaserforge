import { parse } from 'yaml';
import { EditorConfig, EditorRegistryConfig, StartupMode } from './types';

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  startupMode: 'reload_last_yaml',
};

export const EMPTY_EDITOR_REGISTRY: EditorRegistryConfig = {
  arrange: [],
  actions: [],
  conditions: [],
};

async function fetchYaml<T>(url: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback;
  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;
    const text = await response.text();
    const parsed = parse(text);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function loadEditorConfig(): Promise<EditorConfig> {
  const config = await fetchYaml<Partial<EditorConfig>>('/editor-config.yaml', DEFAULT_EDITOR_CONFIG);
  const startupMode = config.startupMode;
  return {
    startupMode: startupMode === 'new_empty_scene' || startupMode === 'reload_last_yaml'
      ? startupMode
      : DEFAULT_EDITOR_CONFIG.startupMode,
  };
}

export async function loadEditorRegistry(): Promise<EditorRegistryConfig> {
  const registry = await fetchYaml<Partial<EditorRegistryConfig>>('/editor-registry.yaml', EMPTY_EDITOR_REGISTRY);
  return {
    arrange: Array.isArray(registry.arrange) ? registry.arrange : [],
    actions: Array.isArray(registry.actions) ? registry.actions : [],
    conditions: Array.isArray(registry.conditions) ? registry.conditions : [],
  };
}

export function coerceStartupMode(value: string | null | undefined, fallback: StartupMode): StartupMode {
  return value === 'new_empty_scene' || value === 'reload_last_yaml' ? value : fallback;
}
