import { parse, stringify } from 'yaml';
import { normalizeProjectPixelsPerUnit } from './projectPixelScale';
import { CollisionRuleSpec, GameSceneSpec, ProjectSpec, TriggerZoneSpec } from './types';
import { migrateSceneSpec } from './migrateScene';

function coerceRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, T>;
}

function migrateLegacySnippetsAndMacrosToPatterns(raw: any): NonNullable<ProjectSpec['patterns']> | undefined {
  const patternsRaw = raw?.patterns;
  if (patternsRaw !== undefined) {
    const patterns = coerceRecord<any>(patternsRaw);
    return Object.keys(patterns).length > 0 ? patterns : {};
  }

  const snippets = raw?.snippets !== undefined ? coerceRecord<any>(raw.snippets) : undefined;
  const macros = raw?.macros !== undefined ? coerceRecord<any>(raw.macros) : undefined;
  if (!snippets && !macros) return undefined;

  const next: NonNullable<ProjectSpec['patterns']> = {};
  const takenIds = new Set<string>();
  const takenNames = new Set<string>();

  if (macros) {
    for (const [id, macro] of Object.entries(macros)) {
      const name = typeof (macro as any)?.name === 'string' && (macro as any).name.length > 0 ? (macro as any).name : id;
      next[id] = {
        id,
        name,
        params: Array.isArray((macro as any)?.params) ? (macro as any).params : [],
        body: Array.isArray((macro as any)?.body) ? (macro as any).body : [],
      };
      takenIds.add(id);
      takenNames.add(name);
    }
  }

  const allocImportedId = (baseId: string): string => {
    if (!takenIds.has(baseId)) return baseId;
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${baseId}-imported${i}`;
      if (!takenIds.has(candidate)) return candidate;
    }
    return `${baseId}-imported${Date.now()}`;
  };

  const allocImportedName = (baseName: string): string => {
    if (!takenNames.has(baseName)) return baseName;
    const imported = `${baseName} (Imported)`;
    if (!takenNames.has(imported)) return imported;
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${baseName} (Imported ${i})`;
      if (!takenNames.has(candidate)) return candidate;
    }
    return `${baseName} (Imported ${Date.now()})`;
  };

  if (snippets) {
    for (const [id, snippet] of Object.entries(snippets)) {
      const rawName = typeof (snippet as any)?.name === 'string' && (snippet as any).name.length > 0 ? (snippet as any).name : id;
      const chosenId = takenIds.has(id) ? allocImportedId(id) : id;
      const chosenName = takenNames.has(rawName) ? allocImportedName(rawName) : rawName;
      next[chosenId] = {
        id: chosenId,
        name: chosenName,
        params: [],
        body: Array.isArray((snippet as any)?.attachmentsTemplate) ? (snippet as any).attachmentsTemplate : [],
        ...(typeof (snippet as any)?.source === 'object' && (snippet as any).source ? { source: (snippet as any).source } : {}),
      };
      takenIds.add(chosenId);
      takenNames.add(chosenName);
    }
  }

  return Object.keys(next).length > 0 ? next : {};
}

function coerceSceneMeta(
  value: unknown,
  scenes: Record<string, GameSceneSpec>
): ProjectSpec['sceneMeta'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, any>;
  const meta: NonNullable<ProjectSpec['sceneMeta']> = {};
  for (const [sceneId, entry] of Object.entries(raw)) {
    if (!scenes[sceneId]) continue;
    if (!entry || typeof entry !== 'object') continue;
    const name = typeof (entry as any).name === 'string' && (entry as any).name.length > 0 ? (entry as any).name : undefined;
    const roleRaw = (entry as any).role;
    const role = roleRaw === 'base' || roleRaw === 'wave' || roleRaw === 'stage' ? roleRaw : undefined;
    if (!name && !role) continue;
    meta[sceneId] = {
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
    };
  }
  return Object.keys(meta).length > 0 ? meta : {};
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

function coerceCollisionRules(value: unknown): CollisionRuleSpec[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rules = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as any;
      const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : null;
      const aLayer = typeof raw.a?.layer === 'string' ? raw.a.layer : null;
      const bLayer = typeof raw.b?.layer === 'string' ? raw.b.layer : null;
      const interaction = raw.interaction === 'block' || raw.interaction === 'overlap' ? raw.interaction : null;
      if (!id || !aLayer || !bLayer || !interaction) return null;
      const coerceCall = (value: unknown) => {
        if (!value || typeof value !== 'object') return undefined;
        const c = value as any;
        if (typeof c.callId !== 'string' || c.callId.length === 0) return undefined;
        const args = c.args && typeof c.args === 'object' ? (c.args as any) : undefined;
        return { callId: c.callId, ...(args ? { args } : {}) };
      };
      const coerceCalls = (value: unknown) => {
        if (!value) return undefined;
        if (Array.isArray(value)) {
          const items = value.map(coerceCall).filter((item): item is NonNullable<ReturnType<typeof coerceCall>> => Boolean(item));
          return items.length > 0 ? items : undefined;
        }
        return coerceCall(value);
      };

      const onEnter = coerceCalls(raw.onEnter);
      return {
        id,
        a: { type: 'layer', layer: aLayer },
        b: { type: 'layer', layer: bLayer },
        interaction,
        ...(onEnter ? { onEnter } : {}),
      } satisfies CollisionRuleSpec;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return rules.length > 0 ? rules : [];
}

function coerceTriggerZones(value: unknown): TriggerZoneSpec[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const zones = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as any;
      const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : null;
      const rect = raw.rect;
      if (!id || !rect || typeof rect !== 'object') return null;
      const x = Number(rect.x);
      const y = Number(rect.y);
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
      const coerceCall = (value: unknown) => {
        if (!value || typeof value !== 'object') return undefined;
        const c = value as any;
        if (typeof c.callId !== 'string' || c.callId.length === 0) return undefined;
        const args = c.args && typeof c.args === 'object' ? (c.args as any) : undefined;
        return { callId: c.callId, ...(args ? { args } : {}) };
      };
      return {
        id,
        ...(typeof raw.name === 'string' && raw.name.length > 0 ? { name: raw.name } : {}),
        ...(raw.enabled != null ? { enabled: Boolean(raw.enabled) } : {}),
        rect: { x, y, width, height },
        ...(coerceCall(raw.onEnter) ? { onEnter: coerceCall(raw.onEnter) } : {}),
        ...(coerceCall(raw.onExit) ? { onExit: coerceCall(raw.onExit) } : {}),
        ...(coerceCall(raw.onClick) ? { onClick: coerceCall(raw.onClick) } : {}),
      } satisfies TriggerZoneSpec;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return zones.length > 0 ? zones : [];
}

export function serializeProjectToYaml(project: ProjectSpec): string {
  // Canonicalize to patterns-only write; legacy keys are read-only during migration window.
  const { snippets: _snippets, macros: _macros, ...rest } = project as any;
  return stringify(rest, {
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
    const input = (sceneRaw as any)?.input && typeof (sceneRaw as any).input === 'object' ? (sceneRaw as any).input : undefined;
    const collisionRules = coerceCollisionRules((sceneRaw as any)?.collisionRules);
    const triggers = coerceTriggerZones((sceneRaw as any)?.triggers);
    scenes[sceneId] = {
      ...(migrated as GameSceneSpec),
      ...(backgroundLayers ? { backgroundLayers } : {}),
      ...(music ? { music } : {}),
      ...(ambience ? { ambience } : {}),
      ...(input ? { input } : {}),
      ...(collisionRules ? { collisionRules } : {}),
      ...(triggers ? { triggers } : {}),
    };
  }

  const initialSceneId = typeof raw.initialSceneId === 'string' ? raw.initialSceneId : sceneEntries[0][0];
  if (!scenes[initialSceneId]) {
    throw new Error(`Project initialSceneId references unknown scene ${initialSceneId}`);
  }

  const baseSceneId = typeof raw.baseSceneId === 'string' ? raw.baseSceneId : undefined;
  if (baseSceneId && !scenes[baseSceneId]) {
    throw new Error(`Project baseSceneId references unknown scene ${baseSceneId}`);
  }
  const sceneMeta = coerceSceneMeta(raw.sceneMeta, scenes);
  const patterns = migrateLegacySnippetsAndMacrosToPatterns(raw);

  return {
    id: typeof raw.id === 'string' ? raw.id : 'project-1',
    ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
    ...(raw.pixelsPerUnit !== undefined ? { pixelsPerUnit: normalizeProjectPixelsPerUnit(raw.pixelsPerUnit) } : {}),
    ...(typeof raw.publishTitle === 'string' ? { publishTitle: raw.publishTitle } : {}),
    ...(() => {
      if (typeof raw.publishGithubPagesRepo === 'string') return { publishGithubPagesRepo: raw.publishGithubPagesRepo };
      if (typeof raw.publishGithubPagesRoute === 'string') return { publishGithubPagesRepo: raw.publishGithubPagesRoute };
      return {};
    })(),
    assets: {
      images: coerceRecord(raw.assets?.images),
      spriteSheets: coerceRecord(raw.assets?.spriteSheets),
      fonts: coerceRecord(raw.assets?.fonts),
    },
    audio: {
      sounds: coerceRecord(raw.audio?.sounds),
    },
    inputMaps: coerceRecord(raw.inputMaps),
    ...(typeof raw.defaultInputMapId === 'string' ? { defaultInputMapId: raw.defaultInputMapId } : {}),
    ...(baseSceneId ? { baseSceneId } : {}),
    ...(sceneMeta ? { sceneMeta } : {}),
    scenes,
    initialSceneId,
    ...(raw.collections !== undefined ? { collections: coerceRecord(raw.collections) } : {}),
    ...(raw.counters !== undefined ? { counters: coerceRecord(raw.counters) } : {}),
    ...(patterns !== undefined ? { patterns } : {}),
  };
}
