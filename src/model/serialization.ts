import { parse, stringify } from 'yaml';
import { GameSceneSpec, ProjectSpec } from './types';
import { migrateSceneSpec } from './migrateScene';

function coerceRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, T>;
}

function coerceSceneMusic(value: unknown): GameSceneSpec['music'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as any;
  if (typeof raw.assetId !== 'string' || raw.assetId.length === 0) return undefined;
  return {
    assetId: raw.assetId,
    loop: Boolean(raw.loop),
    volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 1,
    fadeMs: Number.isFinite(Number(raw.fadeMs)) ? Math.max(0, Number(raw.fadeMs)) : 0,
  };
}

function coerceSceneAmbience(value: unknown): GameSceneSpec['ambience'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as any;
      if (typeof raw.assetId !== 'string' || raw.assetId.length === 0) return null;
      return {
        assetId: raw.assetId,
        loop: Boolean(raw.loop),
        volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 1,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return items.length > 0 ? items : [];
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
    const music = coerceSceneMusic((sceneRaw as any)?.music);
    const ambience = coerceSceneAmbience((sceneRaw as any)?.ambience);
    scenes[sceneId] = {
      ...(migrated as GameSceneSpec),
      ...(backgroundLayers ? { backgroundLayers } : {}),
      ...(music ? { music } : {}),
      ...(ambience ? { ambience } : {}),
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
