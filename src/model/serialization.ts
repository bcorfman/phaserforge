import { parse, stringify } from 'yaml';
import { GameSceneSpec, ProjectSpec, SceneSpec } from './types';
import { migrateSceneSpec } from './migrateScene';

export function serializeSceneToYaml(scene: SceneSpec): string {
  return stringify(scene, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
  });
}

export function parseSceneYaml(text: string): SceneSpec {
  const parsed = parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML scene');
  }
  return migrateSceneSpec(parsed);
}

function coerceRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, T>;
}

export function serializeProjectToYaml(project: ProjectSpec): string {
  return stringify(project, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
  });
}

export function parseProjectYaml(text: string): ProjectSpec {
  const parsed = parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML project');
  }

  const raw = parsed as any;
  const scenesRaw = coerceRecord<any>(raw.scenes);
  const sceneEntries = Object.entries(scenesRaw);
  if (sceneEntries.length === 0) {
    throw new Error('Project must contain at least one scene');
  }

  const scenes: Record<string, GameSceneSpec> = {};
  for (const [sceneId, sceneRaw] of sceneEntries) {
    const migrated = migrateSceneSpec(sceneRaw);
    const backgroundLayers = Array.isArray((sceneRaw as any)?.backgroundLayers)
      ? (sceneRaw as any).backgroundLayers
      : undefined;
    scenes[sceneId] = {
      ...(migrated as GameSceneSpec),
      ...(backgroundLayers ? { backgroundLayers } : {}),
    };
  }

  const initialSceneId = typeof raw.initialSceneId === 'string' ? raw.initialSceneId : sceneEntries[0][0];
  if (!scenes[initialSceneId]) {
    throw new Error(`Project initialSceneId references unknown scene ${initialSceneId}`);
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : 'project-1',
    assets: {
      images: coerceRecord(raw.assets?.images),
      spriteSheets: coerceRecord(raw.assets?.spriteSheets),
    },
    audio: {
      sounds: coerceRecord(raw.audio?.sounds),
    },
    inputMaps: coerceRecord(raw.inputMaps),
    scenes,
    initialSceneId,
  };
}

export function importLegacySceneYamlToProject(sceneYaml: string): ProjectSpec {
  const scene = parseSceneYaml(sceneYaml);
  const sceneId = scene.id || 'scene-1';
  return {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      [sceneId]: { ...(scene as GameSceneSpec), backgroundLayers: [] },
    },
    initialSceneId: sceneId,
  };
}
