import type { Id, ProjectSpec } from '../model/types';
import { parseProjectYaml } from '../model/serialization';
import { buildRevisionEventDetailItems, type ProjectHistoryEvent } from './projectHistoryEvents';

export type SidebarScope = 'projectTree' | 'projectRevisions' | 'scene' | 'project';

export type ProjectRevisionPatchOperation =
  | { op: 'set'; path: Array<string | number>; value: unknown }
  | { op: 'delete'; path: Array<string | number> };

export type ProjectRevisionRecord = {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  sceneCount: number;
  entityCount?: number;
  initialSceneLabel?: string;
  reason: 'autosave' | 'protective' | 'restore';
  kind: 'checkpoint' | 'delta';
  changeSummary?: string;
  historyEventIds?: string[];
  historyBurstIds?: string[];
  project?: ProjectSpec;
  yaml?: string;
  baseRevisionId?: string;
  patch?: ProjectRevisionPatchOperation[];
};

export type ProjectHistoryWindowDays = 7 | 14 | 30;

export const DEFAULT_PROJECT_HISTORY_WINDOW_DAYS: ProjectHistoryWindowDays = 7;

const PROJECT_HISTORY_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProjectTreeRow =
  | { kind: 'project'; id: string; label: string; sceneCount: number }
  | { kind: 'scene'; id: string; label: string; isCurrent: boolean };

export function buildProjectTreeRows(project: ProjectSpec, currentSceneId: Id): ProjectTreeRow[] {
  return [
    {
      kind: 'project',
      id: project.id,
      label: project.title?.trim() || 'Untitled Project',
      sceneCount: Object.keys(project.scenes ?? {}).length,
    },
    ...Object.keys(project.scenes).map((sceneId) => ({
      kind: 'scene' as const,
      id: sceneId,
      label: sceneId,
      isCurrent: sceneId === currentSceneId,
    })),
  ];
}

function shortMonthDay(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.valueOf())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function shortMonthDayTime(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.valueOf())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function revisionAgeMs(updatedAt: string, nowMs: number): number {
  const revisionTimeMs = new Date(updatedAt).valueOf();
  if (Number.isNaN(revisionTimeMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - revisionTimeMs);
}

function isRevisionWithinWindow(
  revision: ProjectRevisionRecord,
  windowDays: number,
  nowMs: number,
): boolean {
  return revisionAgeMs(revision.updatedAt, nowMs) <= windowDays * DAY_MS;
}

function isRevisionOlderThanRetentionWindow(
  revision: ProjectRevisionRecord,
  nowMs: number,
): boolean {
  return revisionAgeMs(revision.updatedAt, nowMs) > PROJECT_HISTORY_RETENTION_DAYS * DAY_MS;
}

type RevisionSnapshot = {
  project?: ProjectSpec;
  title: string;
  sceneCount: number;
  entityCount?: number;
  initialSceneId?: string;
  initialSceneLabel?: string;
  scenesById: Map<string, ProjectSpec['scenes'][string]>;
  sceneLabelsById: Map<string, string>;
  sceneFingerprintsById: Map<string, string>;
  entitySceneById: Map<string, string>;
  soundLabelsById: Map<string, string>;
  sceneMusicById: Map<string, string>;
};

function formatAudioLabel(
  assetId: string,
  project: ProjectSpec,
): string {
  const sound = project.audio?.sounds?.[assetId];
  return sound?.name?.trim()
    || sound?.source?.originalName?.trim()
    || assetId;
}

function cloneProject(project: ProjectSpec): ProjectSpec {
  return structuredClone(project);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diffProjectValue(
  current: unknown,
  previous: unknown,
  path: Array<string | number> = [],
): ProjectRevisionPatchOperation[] {
  if (JSON.stringify(current) === JSON.stringify(previous)) return [];

  if (Array.isArray(current) && Array.isArray(previous)) {
    return [{ op: 'set', path, value: structuredClone(current) }];
  }

  if (isRecord(current) && isRecord(previous)) {
    const ops: ProjectRevisionPatchOperation[] = [];
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const key of keys) {
      if (!(key in current)) {
        ops.push({ op: 'delete', path: [...path, key] });
        continue;
      }
      if (!(key in previous)) {
        ops.push({ op: 'set', path: [...path, key], value: structuredClone(current[key]) });
        continue;
      }
      ops.push(...diffProjectValue(current[key], previous[key], [...path, key]));
    }
    return ops;
  }

  return [{ op: 'set', path, value: structuredClone(current) }];
}

function applyProjectPatch(baseProject: ProjectSpec, patch: ProjectRevisionPatchOperation[]): ProjectSpec {
  const nextProject = cloneProject(baseProject);
  for (const operation of patch) {
    if (operation.path.length === 0) {
      if (operation.op === 'set') return structuredClone(operation.value as ProjectSpec);
      continue;
    }

    let target: unknown = nextProject;
    for (let index = 0; index < operation.path.length - 1; index += 1) {
      const segment = operation.path[index];
      if (target == null || (typeof target !== 'object' && !Array.isArray(target))) break;
      const container = target as Record<string | number, unknown>;
      if (container[segment] == null) {
        const nextSegment = operation.path[index + 1];
        container[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      target = container[segment];
    }

    if (target == null || (typeof target !== 'object' && !Array.isArray(target))) continue;
    const lastSegment = operation.path[operation.path.length - 1];
    if (operation.op === 'delete') {
      if (Array.isArray(target) && typeof lastSegment === 'number') {
        target.splice(lastSegment, 1);
      } else {
        delete (target as Record<string | number, unknown>)[lastSegment];
      }
      continue;
    }
    (target as Record<string | number, unknown>)[lastSegment] = structuredClone(operation.value);
  }
  return nextProject;
}

function materializeRevisionProjectWithBase(
  revision: ProjectRevisionRecord,
  baseProject?: ProjectSpec,
): ProjectSpec | null {
  if (revision.project) return cloneProject(revision.project);
  if (revision.yaml) {
    try {
      return parseProjectYaml(revision.yaml);
    } catch {
      return null;
    }
  }
  if (revision.kind === 'delta' && baseProject && revision.patch) {
    return applyProjectPatch(baseProject, revision.patch);
  }
  return null;
}

function materializeRevisionForAnalysis(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
): ProjectSpec | null {
  if (revisionHistory?.some((entry) => entry.id === revision.id)) {
    return materializeProjectRevision(revisionHistory, revision.id);
  }
  const previousProject = previousRevision
    ? materializeRevisionProjectWithBase(previousRevision)
      ?? (revisionHistory?.some((entry) => entry.id === previousRevision.id)
        ? materializeProjectRevision(revisionHistory, previousRevision.id)
        : null)
    : undefined;
  return materializeRevisionProjectWithBase(revision, previousProject ?? undefined);
}

function buildRevisionSnapshot(project: ProjectSpec, fallbackTitle: string): RevisionSnapshot {
  const sceneLabelsById = new Map(
    Object.keys(project.scenes ?? {}).map((sceneId) => [
      sceneId,
      project.sceneMeta?.[sceneId]?.name?.trim() || sceneId,
    ]),
  );
  const sceneFingerprintsById = new Map(
    Object.entries(project.scenes ?? {}).map(([sceneId, scene]) => [sceneId, JSON.stringify(scene)]),
  );
  const entitySceneById = new Map<string, string>();
  Object.entries(project.scenes ?? {}).forEach(([sceneId, scene]) => {
    Object.keys(scene.entities ?? {}).forEach((entityId) => {
      entitySceneById.set(entityId, sceneId);
    });
  });
  const soundLabelsById = new Map(
    Object.keys(project.audio?.sounds ?? {}).map((assetId) => [assetId, formatAudioLabel(assetId, project)]),
  );
  const sceneMusicById = new Map<string, string>();
  Object.entries(project.scenes ?? {}).forEach(([sceneId, scene]) => {
    if (scene.music?.assetId) {
      sceneMusicById.set(sceneId, scene.music.assetId);
    }
  });
  return {
    project,
    title: project.title?.trim() || fallbackTitle,
    sceneCount: Object.keys(project.scenes ?? {}).length,
    entityCount: Object.values(project.scenes ?? {}).reduce(
      (total, scene) => total + Object.keys(scene.entities ?? {}).length,
      0,
    ),
    initialSceneId: project.initialSceneId,
    initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
    scenesById: new Map(Object.entries(project.scenes ?? {})),
    sceneLabelsById,
    sceneFingerprintsById,
    entitySceneById,
    soundLabelsById,
    sceneMusicById,
  };
}

function buildFallbackRevisionSnapshot(revision: ProjectRevisionRecord): RevisionSnapshot {
  return {
    title: revision.title?.trim() || 'Untitled Project',
    sceneCount: revision.sceneCount,
    entityCount: revision.entityCount,
    initialSceneLabel: revision.initialSceneLabel,
    scenesById: new Map(),
    sceneLabelsById: new Map(),
    sceneFingerprintsById: new Map(),
    entitySceneById: new Map(),
    soundLabelsById: new Map(),
    sceneMusicById: new Map(),
  };
}

export function materializeProjectRevision(
  revisions: ProjectRevisionRecord[],
  revisionId: string,
): ProjectSpec | null {
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  const materializedCache = new Map<string, ProjectSpec | null>();

  const resolveRevision = (id: string): ProjectSpec | null => {
    if (materializedCache.has(id)) return materializedCache.get(id) ?? null;
    const revision = revisionById.get(id);
    if (!revision) return null;
    let materialized: ProjectSpec | null = null;
    if (revision.kind === 'delta' && revision.baseRevisionId) {
      const baseProject = resolveRevision(revision.baseRevisionId);
      materialized = baseProject && revision.patch ? applyProjectPatch(baseProject, revision.patch) : null;
    } else {
      materialized = materializeRevisionProjectWithBase(revision);
    }
    materializedCache.set(id, materialized);
    return materialized;
  };

  return resolveRevision(revisionId);
}

function summarizeRevisionContent(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
): RevisionSnapshot {
  const project = materializeRevisionForAnalysis(revision, previousRevision, revisionHistory);
  if (project) {
    return buildRevisionSnapshot(project, revision.title?.trim() || 'Untitled Project');
  }
  return buildFallbackRevisionSnapshot(revision);
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatSceneDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const addedSceneIds = [...current.sceneLabelsById.keys()].filter((sceneId) => !previous.sceneLabelsById.has(sceneId));
  const removedSceneIds = [...previous.sceneLabelsById.keys()].filter((sceneId) => !current.sceneLabelsById.has(sceneId));
  if (addedSceneIds.length === 0 && removedSceneIds.length === 0) return null;
  if (addedSceneIds.length === 1 && removedSceneIds.length === 0) {
    return `Added scene ${current.sceneLabelsById.get(addedSceneIds[0]) ?? addedSceneIds[0]}`;
  }
  if (removedSceneIds.length === 1 && addedSceneIds.length === 0) {
    return `Removed scene ${previous.sceneLabelsById.get(removedSceneIds[0]) ?? removedSceneIds[0]}`;
  }
  if (addedSceneIds.length > 0 && removedSceneIds.length === 0) {
    return `${formatCountLabel(addedSceneIds.length, 'scene added', 'scenes added')}`;
  }
  if (removedSceneIds.length > 0 && addedSceneIds.length === 0) {
    return `${formatCountLabel(removedSceneIds.length, 'scene removed', 'scenes removed')}`;
  }
  return `Scenes +${addedSceneIds.length}, -${removedSceneIds.length}`;
}

function formatEntityDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  if (current.entitySceneById.size > 0 || previous.entitySceneById.size > 0) {
    const addedEntityIds = [...current.entitySceneById.keys()].filter((entityId) => !previous.entitySceneById.has(entityId));
    const removedEntityIds = [...previous.entitySceneById.keys()].filter((entityId) => !current.entitySceneById.has(entityId));
    const movedEntityCount = [...current.entitySceneById.entries()].filter(
      ([entityId, sceneId]) => previous.entitySceneById.has(entityId) && previous.entitySceneById.get(entityId) !== sceneId,
    ).length;
    if (addedEntityIds.length > 0 && removedEntityIds.length === 0 && movedEntityCount === 0) {
      return formatCountLabel(addedEntityIds.length, 'entity added', 'entities added');
    }
    if (removedEntityIds.length > 0 && addedEntityIds.length === 0 && movedEntityCount === 0) {
      return formatCountLabel(removedEntityIds.length, 'entity removed', 'entities removed');
    }
    if (addedEntityIds.length > 0 || removedEntityIds.length > 0) {
      return `Entities +${addedEntityIds.length}, -${removedEntityIds.length}`;
    }
    if (movedEntityCount > 0) {
      return formatCountLabel(movedEntityCount, 'entity moved', 'entities moved');
    }
  }
  if (typeof current.entityCount === 'number' && typeof previous.entityCount === 'number') {
    const delta = current.entityCount - previous.entityCount;
    if (delta > 0) return formatCountLabel(delta, 'entity added', 'entities added');
    if (delta < 0) return formatCountLabel(Math.abs(delta), 'entity removed', 'entities removed');
  }
  return null;
}

function formatNamedAssetLabel(
  assetId: string,
  assets: Record<string, { name?: string; source?: { originalName?: string } } | undefined> | undefined,
): string {
  const asset = assets?.[assetId];
  return asset?.name?.trim() || asset?.source?.originalName?.trim() || assetId;
}

function formatAssetRecordDiff(
  currentAssets: Record<string, { name?: string; source?: { originalName?: string } } | undefined> | undefined,
  previousAssets: Record<string, { name?: string; source?: { originalName?: string } } | undefined> | undefined,
  singularLabel: string,
  pluralLabel: string,
): string | null {
  const currentIds = Object.keys(currentAssets ?? {});
  const previousIds = Object.keys(previousAssets ?? {});
  const addedAssetIds = currentIds.filter((assetId) => !previousAssets?.[assetId]);
  const removedAssetIds = previousIds.filter((assetId) => !currentAssets?.[assetId]);
  if (addedAssetIds.length === 0 && removedAssetIds.length === 0) return null;
  if (addedAssetIds.length === 1 && removedAssetIds.length === 0) {
    return `Added ${singularLabel} ${formatNamedAssetLabel(addedAssetIds[0], currentAssets)}`;
  }
  if (removedAssetIds.length === 1 && addedAssetIds.length === 0) {
    return `Removed ${singularLabel} ${formatNamedAssetLabel(removedAssetIds[0], previousAssets)}`;
  }
  if (addedAssetIds.length > 0 && removedAssetIds.length === 0) {
    return formatCountLabel(addedAssetIds.length, `${singularLabel} added`, `${pluralLabel} added`);
  }
  if (removedAssetIds.length > 0 && addedAssetIds.length === 0) {
    return formatCountLabel(removedAssetIds.length, `${singularLabel} removed`, `${pluralLabel} removed`);
  }
  return `${pluralLabel[0].toUpperCase()}${pluralLabel.slice(1)} +${addedAssetIds.length}, -${removedAssetIds.length}`;
}

function formatAssetLibraryDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  if (!current.project || !previous.project) return null;
  const assetChanges = [
    formatAssetRecordDiff(current.project.assets?.images, previous.project.assets?.images, 'image asset', 'image assets'),
    formatAssetRecordDiff(current.project.assets?.spriteSheets, previous.project.assets?.spriteSheets, 'sprite sheet', 'sprite sheets'),
    formatAssetRecordDiff(current.project.assets?.fonts, previous.project.assets?.fonts, 'font', 'fonts'),
    formatAssetRecordDiff(current.project.audio?.sounds, previous.project.audio?.sounds, 'audio', 'audio assets'),
  ].filter((value): value is string => Boolean(value));
  if (assetChanges.length === 0) return null;
  return assetChanges.slice(0, 2).join(' · ');
}

function formatSceneMusicDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const changedSceneIds = [...new Set([...current.sceneMusicById.keys(), ...previous.sceneMusicById.keys()])].filter((sceneId) => (
    current.sceneMusicById.get(sceneId) !== previous.sceneMusicById.get(sceneId)
  ));
  if (changedSceneIds.length === 0) return null;
  if (changedSceneIds.length > 1) {
    return formatCountLabel(changedSceneIds.length, 'scene music updated', 'scene music updated');
  }
  const sceneId = changedSceneIds[0];
  const currentMusicId = current.sceneMusicById.get(sceneId);
  const previousMusicId = previous.sceneMusicById.get(sceneId);
  if (currentMusicId && !previousMusicId) {
    return `Music -> ${current.soundLabelsById.get(currentMusicId) ?? currentMusicId}`;
  }
  if (!currentMusicId && previousMusicId) {
    return 'Removed music';
  }
  if (currentMusicId) {
    return `Music -> ${current.soundLabelsById.get(currentMusicId) ?? currentMusicId}`;
  }
  return null;
}

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function formatEntityLabel(entityId: string, entity: { name?: string } | undefined): string {
  return entity?.name?.trim() || entityId;
}

function formatEntityEditDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const changedEntities: Array<{
    sceneId: string;
    entityId: string;
    currentEntity: NonNullable<ProjectSpec['scenes'][string]>['entities'][string];
    previousEntity: NonNullable<ProjectSpec['scenes'][string]>['entities'][string];
  }> = [];

  for (const [sceneId, currentScene] of current.scenesById.entries()) {
    const previousScene = previous.scenesById.get(sceneId);
    if (!previousScene) continue;
    for (const [entityId, currentEntity] of Object.entries(currentScene.entities ?? {})) {
      const previousEntity = previousScene.entities?.[entityId];
      if (!previousEntity) continue;
      if (JSON.stringify(currentEntity) !== JSON.stringify(previousEntity)) {
        changedEntities.push({ sceneId, entityId, currentEntity, previousEntity });
      }
    }
  }

  if (changedEntities.length === 0) return null;
  if (changedEntities.length > 1) return formatCountLabel(changedEntities.length, 'entity edited', 'entities edited');

  const { entityId, currentEntity, previousEntity } = changedEntities[0];
  const currentLabel = formatEntityLabel(entityId, currentEntity);
  const previousLabel = formatEntityLabel(entityId, previousEntity);

  if (
    currentEntity.name !== previousEntity.name
    && JSON.stringify(omitKeys(currentEntity as unknown as Record<string, unknown>, ['name']))
      === JSON.stringify(omitKeys(previousEntity as unknown as Record<string, unknown>, ['name']))
  ) {
    if (!previousEntity.name?.trim() && currentEntity.name?.trim()) {
      return `Named entity ${currentLabel}`;
    }
    return `Renamed entity ${previousLabel} -> ${currentLabel}`;
  }

  if (
    (currentEntity.x !== previousEntity.x || currentEntity.y !== previousEntity.y)
    && JSON.stringify(omitKeys(currentEntity as unknown as Record<string, unknown>, ['x', 'y']))
      === JSON.stringify(omitKeys(previousEntity as unknown as Record<string, unknown>, ['x', 'y']))
  ) {
    return `Moved entity ${currentLabel}`;
  }

  if (
    currentEntity.text?.value !== previousEntity.text?.value
    && JSON.stringify({
      ...currentEntity,
      text: currentEntity.text ? { ...currentEntity.text, value: undefined } : currentEntity.text,
    }) === JSON.stringify({
      ...previousEntity,
      text: previousEntity.text ? { ...previousEntity.text, value: undefined } : previousEntity.text,
    })
  ) {
    return `Edited text ${currentLabel}`;
  }

  return `Edited entity ${currentLabel}`;
}

function formatSceneRenameDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const renamedSceneIds = [...current.sceneLabelsById.keys()].filter((sceneId) => (
    previous.sceneLabelsById.has(sceneId)
    && previous.sceneLabelsById.get(sceneId) !== current.sceneLabelsById.get(sceneId)
  ));
  if (renamedSceneIds.length === 0) return null;
  if (renamedSceneIds.length > 1) return formatCountLabel(renamedSceneIds.length, 'scene renamed', 'scenes renamed');
  const sceneId = renamedSceneIds[0];
  return `Renamed scene ${previous.sceneLabelsById.get(sceneId) ?? sceneId} -> ${current.sceneLabelsById.get(sceneId) ?? sceneId}`;
}

function diffRecordKeys(currentRecord: Record<string, unknown> | undefined, previousRecord: Record<string, unknown> | undefined): {
  added: string[];
  removed: string[];
  changed: string[];
} {
  const currentKeys = new Set(Object.keys(currentRecord ?? {}));
  const previousKeys = new Set(Object.keys(previousRecord ?? {}));
  const added = [...currentKeys].filter((key) => !previousKeys.has(key));
  const removed = [...previousKeys].filter((key) => !currentKeys.has(key));
  const changed = [...currentKeys].filter((key) => (
    previousKeys.has(key) && JSON.stringify(currentRecord?.[key]) !== JSON.stringify(previousRecord?.[key])
  ));
  return { added, removed, changed };
}

function diffListById<T extends { id: string }>(
  currentItems: T[] | undefined,
  previousItems: T[] | undefined,
): {
  added: T[];
  removed: T[];
  changed: T[];
} {
  const currentById = new Map((currentItems ?? []).map((item) => [item.id, item]));
  const previousById = new Map((previousItems ?? []).map((item) => [item.id, item]));
  const added = [...currentById.entries()].filter(([id]) => !previousById.has(id)).map(([, item]) => item);
  const removed = [...previousById.entries()].filter(([id]) => !currentById.has(id)).map(([, item]) => item);
  const changed = [...currentById.entries()]
    .filter(([id, item]) => previousById.has(id) && JSON.stringify(item) !== JSON.stringify(previousById.get(id)))
    .map(([, item]) => item);
  return { added, removed, changed };
}

function formatTriggerLabel(trigger: { id: string; name?: string }): string {
  return trigger.name?.trim() || trigger.id;
}

function formatNamedTriggerDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  for (const [sceneId, currentScene] of current.scenesById.entries()) {
    const previousScene = previous.scenesById.get(sceneId);
    if (!previousScene) continue;
    const { added, removed, changed } = diffListById(currentScene.triggers, previousScene.triggers);
    if (added.length === 1 && removed.length === 0 && changed.length === 0) {
      return `Added trigger ${formatTriggerLabel(added[0])}`;
    }
    if (removed.length === 1 && added.length === 0 && changed.length === 0) {
      return `Removed trigger ${formatTriggerLabel(removed[0])}`;
    }
    if (changed.length === 1 && added.length === 0 && removed.length === 0) {
      return `Updated trigger ${formatTriggerLabel(changed[0])}`;
    }
    if (added.length + removed.length + changed.length > 0) {
      return `Updated triggers in ${current.sceneLabelsById.get(sceneId) ?? sceneId}`;
    }
  }
  return null;
}

function formatSceneSystemDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const sceneSystemLabels: Array<[keyof NonNullable<ProjectSpec['scenes'][string]>, string]> = [
    ['backgroundLayers', 'background layers'],
    ['groups', 'groups'],
    ['attachments', 'attachments'],
    ['eventBlocks', 'event blocks'],
    ['collisionRules', 'collision rules'],
    ['input', 'input'],
    ['ambience', 'ambience'],
    ['behaviors', 'behaviors'],
    ['actions', 'actions'],
    ['conditions', 'conditions'],
  ];

  for (const [sceneId, currentScene] of current.scenesById.entries()) {
    const previousScene = previous.scenesById.get(sceneId);
    if (!previousScene) continue;
    for (const [key, label] of sceneSystemLabels) {
      if (JSON.stringify(currentScene[key]) !== JSON.stringify(previousScene[key])) {
        return `Updated ${label} in ${current.sceneLabelsById.get(sceneId) ?? sceneId}`;
      }
    }
  }
  return null;
}

function formatSceneEditDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const changedSceneIds = [...current.sceneFingerprintsById.keys()].filter((sceneId) => (
    previous.sceneFingerprintsById.has(sceneId)
    && previous.sceneFingerprintsById.get(sceneId) !== current.sceneFingerprintsById.get(sceneId)
  ));
  if (changedSceneIds.length === 0) return null;
  if (changedSceneIds.length === 1) {
    const sceneId = changedSceneIds[0];
    return `Edited scene ${current.sceneLabelsById.get(sceneId) ?? sceneId}`;
  }
  return `Edited ${changedSceneIds.length} scenes`;
}

function formatProjectSystemDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  if (!current.project || !previous.project) return null;
  const inputMapDiff = diffRecordKeys(current.project.inputMaps, previous.project.inputMaps);
  if (inputMapDiff.added.length === 1 && inputMapDiff.removed.length === 0 && inputMapDiff.changed.length === 0) {
    return `Added input map ${inputMapDiff.added[0]}`;
  }
  if (inputMapDiff.removed.length === 1 && inputMapDiff.added.length === 0 && inputMapDiff.changed.length === 0) {
    return `Removed input map ${inputMapDiff.removed[0]}`;
  }
  if (inputMapDiff.changed.length === 1 && inputMapDiff.added.length === 0 && inputMapDiff.removed.length === 0) {
    return `Updated input map ${inputMapDiff.changed[0]}`;
  }
  if (inputMapDiff.added.length + inputMapDiff.removed.length + inputMapDiff.changed.length > 0) {
    return 'Updated input maps';
  }
  if (current.project.publishTitle !== previous.project.publishTitle) {
    if (!previous.project.publishTitle && current.project.publishTitle) {
      return `Set publish title to ${current.project.publishTitle}`;
    }
    if (previous.project.publishTitle && !current.project.publishTitle) {
      return 'Cleared publish title';
    }
    return 'Updated publish title';
  }
  if (current.project.publishGithubPagesRepo !== previous.project.publishGithubPagesRepo) {
    if (!previous.project.publishGithubPagesRepo && current.project.publishGithubPagesRepo) {
      return `Set publish repo to ${current.project.publishGithubPagesRepo}`;
    }
    if (previous.project.publishGithubPagesRepo && !current.project.publishGithubPagesRepo) {
      return 'Cleared publish repo';
    }
    return 'Updated publish repo';
  }
  const projectSystemChecks: Array<{ current: unknown; previous: unknown; label: string }> = [
    { current: current.project.assets?.images, previous: previous.project.assets?.images, label: 'Updated image assets' },
    { current: current.project.assets?.spriteSheets, previous: previous.project.assets?.spriteSheets, label: 'Updated sprite sheets' },
    { current: current.project.assets?.fonts, previous: previous.project.assets?.fonts, label: 'Updated fonts' },
    { current: current.project.defaultInputMapId, previous: previous.project.defaultInputMapId, label: 'Updated input maps' },
    { current: current.project.collections, previous: previous.project.collections, label: 'Updated collections' },
    { current: current.project.counters, previous: previous.project.counters, label: 'Updated counters' },
    { current: current.project.patterns, previous: previous.project.patterns, label: 'Updated patterns' },
    { current: current.project.baseSceneId, previous: previous.project.baseSceneId, label: 'Updated base scene' },
  ];
  for (const check of projectSystemChecks) {
    if (JSON.stringify(check.current) !== JSON.stringify(check.previous)) {
      return check.label;
    }
  }
  return null;
}

function formatPublishMetadataDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  if (!current.project || !previous.project) return null;
  if (current.project.publishTitle !== previous.project.publishTitle) {
    if (!previous.project.publishTitle && current.project.publishTitle) {
      return `Set publish title to ${current.project.publishTitle}`;
    }
    if (previous.project.publishTitle && !current.project.publishTitle) {
      return 'Cleared publish title';
    }
    return 'Updated publish title';
  }
  if (current.project.publishGithubPagesRepo !== previous.project.publishGithubPagesRepo) {
    if (!previous.project.publishGithubPagesRepo && current.project.publishGithubPagesRepo) {
      return `Set publish repo to ${current.project.publishGithubPagesRepo}`;
    }
    if (previous.project.publishGithubPagesRepo && !current.project.publishGithubPagesRepo) {
      return 'Cleared publish repo';
    }
    return 'Updated publish repo';
  }
  return null;
}

export function formatProjectRevisionTimestamp(revision: ProjectRevisionRecord): string {
  return shortMonthDayTime(revision.updatedAt);
}

function buildProjectRevisionDetailItemsInternal(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
  historyEvents?: ProjectHistoryEvent[],
): string[] {
  const current = summarizeRevisionContent(revision, previousRevision, revisionHistory);
  if (!previousRevision) {
    const sceneLabel = current.sceneCount === 1 ? '1 scene' : `${current.sceneCount} scenes`;
    const entityLabel = typeof current.entityCount === 'number'
      ? `${current.entityCount} ${current.entityCount === 1 ? 'entity' : 'entities'}`
      : undefined;
    return [['Initial snapshot', sceneLabel, entityLabel].filter(Boolean).join(' · ')];
  }
  const eventDetailItems = buildRevisionEventDetailItems(revision, historyEvents);
  if (eventDetailItems.length > 0) return eventDetailItems;
  if (revision.changeSummary?.trim()) return [revision.changeSummary.trim()];

  const previous = summarizeRevisionContent(previousRevision, undefined, revisionHistory);
  const specificChanges = [
    current.title !== previous.title ? `Renamed to ${current.title}` : null,
    formatSceneRenameDiff(current, previous),
    formatSceneDiff(current, previous),
    current.initialSceneId && previous.initialSceneId && current.initialSceneId !== previous.initialSceneId
      ? `Start scene -> ${current.initialSceneLabel ?? current.initialSceneId}`
      : null,
    formatEntityDiff(current, previous),
    formatAssetLibraryDiff(current, previous),
    formatSceneMusicDiff(current, previous),
    formatEntityEditDiff(current, previous),
    formatPublishMetadataDiff(current, previous),
    revision.reason === 'restore' ? 'Restored older version' : null,
    revision.reason === 'protective' ? 'Safety checkpoint' : null,
  ].filter((value): value is string => Boolean(value));

  if (specificChanges.length > 0) return specificChanges;
  const namedTriggerChange = formatNamedTriggerDiff(current, previous);
  if (namedTriggerChange) return [namedTriggerChange];
  const sceneSystemChange = formatSceneSystemDiff(current, previous);
  if (sceneSystemChange) return [sceneSystemChange];
  const broadSceneChange = formatSceneEditDiff(current, previous);
  if (broadSceneChange) return [broadSceneChange];
  const projectSystemChange = formatProjectSystemDiff(current, previous);
  if (projectSystemChange) return [projectSystemChange];
  const currentProject = materializeRevisionProjectWithBase(revision, previous.project);
  const previousProject = previous.project;
  return [currentProject && previousProject && JSON.stringify(currentProject) !== JSON.stringify(previousProject)
    ? 'Updated project settings'
    : 'Minor edits'];
}

export function buildProjectRevisionDetailItems(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
  historyEvents?: ProjectHistoryEvent[],
): string[] {
  return buildProjectRevisionDetailItemsInternal(revision, previousRevision, revisionHistory, historyEvents);
}

export function formatProjectRevisionSummary(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
  historyEvents?: ProjectHistoryEvent[],
): string {
  const detailItems = buildProjectRevisionDetailItemsInternal(revision, previousRevision, revisionHistory, historyEvents);
  return detailItems.slice(0, 2).join(' · ');
}

export function buildCopyRevisionDefaultName(projectTitle: string | undefined, revision: ProjectRevisionRecord): string {
  const base = projectTitle?.trim() || revision.title?.trim() || 'Untitled Project';
  return `${base} - Copy from ${shortMonthDay(revision.updatedAt)}`;
}

export function buildRestoreRevisionStatus(revision: ProjectRevisionRecord): { message: string } {
  return {
    message: `Restored revision from ${shortMonthDay(revision.updatedAt)} as the new current project.`,
  };
}

export function rebuildProjectRevisions(
  revisions: ProjectRevisionRecord[] | undefined,
  fallbackProject?: ProjectSpec,
): ProjectRevisionRecord[] {
  const originalRevisions = Array.isArray(revisions) ? revisions.filter(Boolean) : [];
  if (originalRevisions.length === 0) {
    return fallbackProject ? [createProjectRevision(fallbackProject)] : [];
  }
  return rebuildProjectRevisionSubset(originalRevisions, originalRevisions, fallbackProject);
}

function rebuildProjectRevisionSubset(
  sourceRevisions: ProjectRevisionRecord[],
  selectedRevisions: ProjectRevisionRecord[],
  fallbackProject?: ProjectSpec,
): ProjectRevisionRecord[] {
  if (selectedRevisions.length === 0) {
    return fallbackProject ? [createProjectRevision(fallbackProject)] : [];
  }

  const recoverableOldestToNewest = [...selectedRevisions]
    .reverse()
    .map((revision) => ({
      revision,
      project: materializeProjectRevision(sourceRevisions, revision.id),
    }))
    .filter((entry): entry is { revision: ProjectRevisionRecord; project: ProjectSpec } => Boolean(entry.project));

  if (recoverableOldestToNewest.length === 0) {
    return fallbackProject ? [createProjectRevision(fallbackProject)] : [];
  }

  let rebuilt: ProjectRevisionRecord[] = [];
  for (const entry of recoverableOldestToNewest) {
    rebuilt = appendProjectRevision(rebuilt, createProjectRevision(entry.project, {
      id: entry.revision.id,
      updatedAt: entry.revision.updatedAt,
      reason: entry.revision.reason,
      changeSummary: entry.revision.changeSummary,
      historyEventIds: entry.revision.historyEventIds,
      historyBurstIds: entry.revision.historyBurstIds,
    }), selectedRevisions.length);
  }
  return rebuilt;
}

export function buildProjectHistoryViewModel({
  revisions,
  archivedRevisions,
  windowDays = DEFAULT_PROJECT_HISTORY_WINDOW_DAYS,
  nowMs = Date.now(),
}: {
  revisions: ProjectRevisionRecord[] | undefined;
  archivedRevisions?: ProjectRevisionRecord[] | undefined;
  windowDays?: ProjectHistoryWindowDays;
  nowMs?: number;
}): {
  visibleRevisions: ProjectRevisionRecord[];
  staleRevisions: ProjectRevisionRecord[];
  archivedRevisions: ProjectRevisionRecord[];
} {
  const activeRevisions = Array.isArray(revisions) ? revisions.filter(Boolean) : [];
  const visibleRevisions = activeRevisions.filter((revision) => (
    isRevisionWithinWindow(revision, windowDays, nowMs)
    && !isRevisionOlderThanRetentionWindow(revision, nowMs)
  ));
  const staleRevisions = activeRevisions.filter((revision) => isRevisionOlderThanRetentionWindow(revision, nowMs));
  return {
    visibleRevisions,
    staleRevisions,
    archivedRevisions: Array.isArray(archivedRevisions) ? archivedRevisions.filter(Boolean) : [],
  };
}

function withGuaranteedHeadRevision(
  revisions: ProjectRevisionRecord[],
  currentProject: ProjectSpec,
): ProjectRevisionRecord[] {
  return revisions.length > 0 ? revisions : [createProjectRevision(currentProject)];
}

export function archiveProjectHistoryRevisions({
  activeRevisions,
  archivedRevisions,
  revisionIds,
  currentProject,
}: {
  activeRevisions: ProjectRevisionRecord[] | undefined;
  archivedRevisions?: ProjectRevisionRecord[] | undefined;
  revisionIds: string[];
  currentProject: ProjectSpec;
}): {
  revisions: ProjectRevisionRecord[];
  archivedRevisions: ProjectRevisionRecord[];
} {
  const revisionIdSet = new Set(revisionIds);
  const active = Array.isArray(activeRevisions) ? activeRevisions.filter(Boolean) : [];
  const archived = Array.isArray(archivedRevisions) ? archivedRevisions.filter(Boolean) : [];
  const archivedSubset = active.filter((revision) => revisionIdSet.has(revision.id));
  const keptActive = active.filter((revision) => !revisionIdSet.has(revision.id));

  return {
    revisions: withGuaranteedHeadRevision(rebuildProjectRevisionSubset(active, keptActive), currentProject),
    archivedRevisions: [
      ...rebuildProjectRevisionSubset(active, archivedSubset),
      ...archived.filter((revision) => !revisionIdSet.has(revision.id)),
    ],
  };
}

export function deleteProjectHistoryRevisions({
  activeRevisions,
  archivedRevisions,
  revisionIds,
  currentProject,
}: {
  activeRevisions: ProjectRevisionRecord[] | undefined;
  archivedRevisions?: ProjectRevisionRecord[] | undefined;
  revisionIds: string[];
  currentProject: ProjectSpec;
}): {
  revisions: ProjectRevisionRecord[];
  archivedRevisions: ProjectRevisionRecord[];
} {
  const revisionIdSet = new Set(revisionIds);
  const sourceActive = (Array.isArray(activeRevisions) ? activeRevisions : []).filter(Boolean);
  const keptActive = sourceActive.filter((revision) => !revisionIdSet.has(revision.id));
  const keptArchived = (Array.isArray(archivedRevisions) ? archivedRevisions : []).filter((revision) => !revisionIdSet.has(revision.id));

  return {
    revisions: withGuaranteedHeadRevision(rebuildProjectRevisionSubset(sourceActive, keptActive), currentProject),
    archivedRevisions: rebuildProjectRevisions(keptArchived),
  };
}

export function createProjectRevision(
  project: ProjectSpec,
  options?: {
    id?: string;
    updatedAt?: string;
    reason?: ProjectRevisionRecord['reason'];
    changeSummary?: string;
    historyEventIds?: string[];
    historyBurstIds?: string[];
    yaml?: string;
  }
): ProjectRevisionRecord {
  return {
    id: options?.id ?? `revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    title: project.title?.trim() || 'Untitled Project',
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
    sceneCount: Object.keys(project.scenes ?? {}).length,
    entityCount: Object.values(project.scenes ?? {}).reduce(
      (total, scene) => total + Object.keys(scene.entities ?? {}).length,
      0,
    ),
    initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
    reason: options?.reason ?? 'autosave',
    kind: 'checkpoint',
    changeSummary: options?.changeSummary?.trim() || undefined,
    historyEventIds: options?.historyEventIds?.length ? [...options.historyEventIds] : undefined,
    historyBurstIds: options?.historyBurstIds?.length ? [...options.historyBurstIds] : undefined,
    project: cloneProject(project),
    yaml: options?.yaml,
  };
}

type RevisionChangeProfile = {
  domains: Set<string>;
  focusKeys: Set<string>;
  clusterKeys: Set<string>;
};

const REVISION_MILESTONE_DOMAINS = new Set([
  'project-title',
  'publish',
  'scene-metadata',
  'scenes',
]);

const REVISION_ALLOWED_DOMAIN_GROUPS = [
  new Set(['audio', 'music', 'ambience']),
  new Set(['attachments', 'event-blocks']),
  new Set(['actions', 'behaviors', 'conditions']),
  new Set(['input-maps', 'scene-input']),
];

const REVISION_ALLOWED_MILESTONE_DOMAIN_GROUPS = [
  new Set(['project-title', 'publish']),
];

function addRecordDiffFocus(
  domains: Set<string>,
  focusKeys: Set<string>,
  domain: string,
  focusPrefix: string,
  currentRecord: Record<string, unknown> | undefined,
  previousRecord: Record<string, unknown> | undefined,
): string[] {
  const diff = diffRecordKeys(currentRecord, previousRecord);
  const changedKeys = [...diff.added, ...diff.removed, ...diff.changed];
  if (changedKeys.length === 0) return [];
  domains.add(domain);
  changedKeys.forEach((key) => focusKeys.add(`${focusPrefix}:${key}`));
  return changedKeys;
}

function diffRecordPresenceKeys(
  currentRecord: Record<string, unknown> | undefined,
  previousRecord: Record<string, unknown> | undefined,
): string[] {
  const currentKeys = new Set(Object.keys(currentRecord ?? {}));
  const previousKeys = new Set(Object.keys(previousRecord ?? {}));
  return [
    ...[...currentKeys].filter((key) => !previousKeys.has(key)),
    ...[...previousKeys].filter((key) => !currentKeys.has(key)),
  ];
}

function addListDiffFocus<T extends { id: string }>(
  domains: Set<string>,
  focusKeys: Set<string>,
  domain: string,
  focusPrefix: string,
  currentItems: T[] | undefined,
  previousItems: T[] | undefined,
): T[] {
  const diff = diffListById(currentItems, previousItems);
  const changedItems = [...diff.added, ...diff.removed, ...diff.changed];
  if (changedItems.length === 0) return [];
  domains.add(domain);
  changedItems.forEach((item) => focusKeys.add(`${focusPrefix}:${item.id}`));
  return changedItems;
}

function addEntityRelatedFocusKeys(focusKeys: Set<string>, sceneId: string, entity: ProjectSpec['scenes'][string]['entities'][string] | undefined): void {
  if (!entity) return;
  if (entity.asset?.source.kind === 'asset' && entity.asset.source.assetId) {
    const assetPrefix = entity.asset.imageType === 'spritesheet' ? 'spritesheet' : 'image';
    focusKeys.add(`${assetPrefix}:${entity.asset.source.assetId}`);
  }
  if (entity.text?.fontAssetId) {
    focusKeys.add(`font:${entity.text.fontAssetId}`);
  }
  focusKeys.add(`scene-entity:${sceneId}:${entity.id}`);
}

function addSceneTargetFocusKey(
  focusKeys: Set<string>,
  sceneId: string,
  target: { type: 'entity'; entityId: string } | { type: 'group'; groupId: string } | undefined,
): void {
  if (!target) return;
  if (target.type === 'entity') {
    focusKeys.add(`entity:${sceneId}:${target.entityId}`);
    return;
  }
  focusKeys.add(`group:${sceneId}:${target.groupId}`);
}

function addAttachmentRelatedFocusKeys(
  focusKeys: Set<string>,
  sceneId: string,
  attachment: ProjectSpec['scenes'][string]['attachments'][string] | undefined,
): void {
  if (!attachment) return;
  addSceneTargetFocusKey(focusKeys, sceneId, attachment.target);
  if (attachment.eventId) focusKeys.add(`event-block:${sceneId}:${attachment.eventId}`);
  if (attachment.parentAttachmentId) focusKeys.add(`attachment:${sceneId}:${attachment.parentAttachmentId}`);
}

function addEventBlockRelatedFocusKeys(
  focusKeys: Set<string>,
  sceneId: string,
  eventBlock: NonNullable<ProjectSpec['scenes'][string]['eventBlocks']>[string] | undefined,
): void {
  if (!eventBlock) return;
  addSceneTargetFocusKey(focusKeys, sceneId, eventBlock.target);
}

function addBehaviorRelatedFocusKeys(
  focusKeys: Set<string>,
  sceneId: string,
  behavior: ProjectSpec['scenes'][string]['behaviors'][string] | undefined,
): void {
  if (!behavior) return;
  addSceneTargetFocusKey(focusKeys, sceneId, behavior.target);
  if (behavior.rootActionId) focusKeys.add(`action:${sceneId}:${behavior.rootActionId}`);
}

function addSceneInputRelatedFocusKeys(
  focusKeys: Set<string>,
  sceneId: string,
  input: ProjectSpec['scenes'][string]['input'] | undefined,
): void {
  focusKeys.add(`scene-input:${sceneId}`);
  if (input?.activeMapId) focusKeys.add(`input-map:${input.activeMapId}`);
  if (input?.fallbackMapId) focusKeys.add(`input-map:${input.fallbackMapId}`);
  if (input?.mouse?.driveEntityId) focusKeys.add(`entity:${sceneId}:${input.mouse.driveEntityId}`);
}

function addSceneAssetFocusKeys(focusKeys: Set<string>, sceneId: string, scene: ProjectSpec['scenes'][string] | undefined): void {
  if (!scene) return;
  scene.backgroundLayers?.forEach((layer) => focusKeys.add(`image:${layer.assetId}`));
  scene.ambience?.forEach((entry) => focusKeys.add(`audio:${entry.assetId}`));
  if (scene.music?.assetId) focusKeys.add(`audio:${scene.music.assetId}`);
  focusKeys.add(`scene:${sceneId}`);
}

function focusKeyToClusterKey(focusKey: string): string | null {
  if (focusKey.startsWith('scene-entity:')) {
    return focusKey.replace('scene-entity:', 'entity:');
  }
  if (focusKey.startsWith('scene-meta:')) {
    return focusKey.replace('scene-meta:', 'scene:');
  }
  if (focusKey.startsWith('music:')) {
    return focusKey.replace('music:', 'scene-music:');
  }
  if (
    focusKey.startsWith('entity:')
    || focusKey.startsWith('group:')
    || focusKey.startsWith('trigger:')
    || focusKey.startsWith('collision-rule:')
    || focusKey.startsWith('attachment:')
    || focusKey.startsWith('event-block:')
    || focusKey.startsWith('behavior:')
    || focusKey.startsWith('action:')
    || focusKey.startsWith('condition:')
    || focusKey.startsWith('scene:')
    || focusKey.startsWith('counter:')
    || focusKey.startsWith('pattern:')
    || focusKey.startsWith('collection:')
    || focusKey.startsWith('audio:')
    || focusKey.startsWith('image:')
    || focusKey.startsWith('spritesheet:')
    || focusKey.startsWith('font:')
    || focusKey.startsWith('input-map:')
    || focusKey.startsWith('scene-input:')
  ) {
    return focusKey;
  }
  return null;
}

function buildClusterKeys(focusKeys: Set<string>): Set<string> {
  return new Set(
    [...focusKeys]
      .map(focusKeyToClusterKey)
      .filter((clusterKey): clusterKey is string => Boolean(clusterKey)),
  );
}

function isAllowedRevisionDomainBlend(domains: Set<string>): boolean {
  return REVISION_ALLOWED_DOMAIN_GROUPS.some((allowedDomains) => (
    domains.size > 1 && [...domains].every((domain) => allowedDomains.has(domain))
  ));
}

function isAllowedRevisionMilestoneBlend(domains: Set<string>): boolean {
  return REVISION_ALLOWED_MILESTONE_DOMAIN_GROUPS.some((allowedDomains) => (
    domains.size > 1 && [...domains].every((domain) => allowedDomains.has(domain))
  ));
}

function buildRevisionChangeProfile(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
  revisionHistory?: ProjectRevisionRecord[],
): RevisionChangeProfile {
  if (!previousRevision) return { domains: new Set(), focusKeys: new Set(), clusterKeys: new Set() };
  const current = summarizeRevisionContent(revision, previousRevision, revisionHistory);
  const previous = summarizeRevisionContent(previousRevision, undefined, revisionHistory);
  const domains = new Set<string>();
  const focusKeys = new Set<string>();

  if (current.title !== previous.title) {
    domains.add('project-title');
    focusKeys.add('project-title');
  }

  addRecordDiffFocus(domains, focusKeys, 'image-assets', 'image', current.project?.assets.images, previous.project?.assets.images);
  addRecordDiffFocus(domains, focusKeys, 'spritesheets', 'spritesheet', current.project?.assets.spriteSheets, previous.project?.assets.spriteSheets);
  addRecordDiffFocus(domains, focusKeys, 'fonts', 'font', current.project?.assets.fonts, previous.project?.assets.fonts);

  const addedSoundIds = [...current.soundLabelsById.keys()].filter((assetId) => !previous.soundLabelsById.has(assetId));
  const removedSoundIds = [...previous.soundLabelsById.keys()].filter((assetId) => !current.soundLabelsById.has(assetId));
  if (addedSoundIds.length > 0 || removedSoundIds.length > 0) {
    domains.add('audio');
    addedSoundIds.forEach((assetId) => focusKeys.add(`audio:${assetId}`));
    removedSoundIds.forEach((assetId) => focusKeys.add(`audio:${assetId}`));
  }

  const changedSceneMusicIds = [...new Set([...current.sceneMusicById.keys(), ...previous.sceneMusicById.keys()])]
    .filter((sceneId) => current.sceneMusicById.get(sceneId) !== previous.sceneMusicById.get(sceneId));
  if (changedSceneMusicIds.length > 0) {
    domains.add('music');
    changedSceneMusicIds.forEach((sceneId) => {
      focusKeys.add(`music:${sceneId}`);
      const assetId = current.sceneMusicById.get(sceneId) ?? previous.sceneMusicById.get(sceneId);
      if (assetId) focusKeys.add(`audio:${assetId}`);
    });
  }

  if (current.project?.defaultInputMapId !== previous.project?.defaultInputMapId) {
    domains.add('input-maps');
    if (current.project?.defaultInputMapId) focusKeys.add(`input-map:${current.project.defaultInputMapId}`);
    if (previous.project?.defaultInputMapId) focusKeys.add(`input-map:${previous.project.defaultInputMapId}`);
  }
  addRecordDiffFocus(domains, focusKeys, 'input-maps', 'input-map', current.project?.inputMaps, previous.project?.inputMaps);

  if (
    current.project?.publishTitle !== previous.project?.publishTitle
    || current.project?.publishGithubPagesRepo !== previous.project?.publishGithubPagesRepo
  ) {
    domains.add('publish');
    if (current.project?.publishTitle !== previous.project?.publishTitle) focusKeys.add('publish:title');
    if (current.project?.publishGithubPagesRepo !== previous.project?.publishGithubPagesRepo) focusKeys.add('publish:repo');
  }

  if (current.project?.baseSceneId !== previous.project?.baseSceneId) {
    domains.add('scenes');
    if (current.project?.baseSceneId) focusKeys.add(`scene:${current.project.baseSceneId}`);
    if (previous.project?.baseSceneId) focusKeys.add(`scene:${previous.project.baseSceneId}`);
  }
  const changedSceneIds = diffRecordPresenceKeys(current.project?.scenes, previous.project?.scenes);
  if (changedSceneIds.length > 0) {
    domains.add('scenes');
    changedSceneIds.forEach((sceneId) => focusKeys.add(`scene:${sceneId}`));
  }
  addRecordDiffFocus(domains, focusKeys, 'scene-metadata', 'scene-meta', current.project?.sceneMeta, previous.project?.sceneMeta);
  addRecordDiffFocus(domains, focusKeys, 'collections', 'collection', current.project?.collections, previous.project?.collections);
  addRecordDiffFocus(domains, focusKeys, 'counters', 'counter', current.project?.counters, previous.project?.counters);
  addRecordDiffFocus(domains, focusKeys, 'patterns', 'pattern', current.project?.patterns, previous.project?.patterns);

  for (const [sceneId, currentScene] of current.scenesById.entries()) {
    const previousScene = previous.scenesById.get(sceneId);
    if (!previousScene) continue;

    if (JSON.stringify(currentScene.world ?? undefined) !== JSON.stringify(previousScene.world ?? undefined)) {
      domains.add('scene-world');
      focusKeys.add(`scene:${sceneId}`);
      focusKeys.add(`scene-world:${sceneId}`);
    }

    const changedGroups = addRecordDiffFocus(domains, focusKeys, 'groups', `group:${sceneId}`, currentScene.groups, previousScene.groups);
    if (changedGroups.length > 0) focusKeys.add(`scene:${sceneId}`);

    const entityIds = new Set([
      ...Object.keys(currentScene.entities ?? {}),
      ...Object.keys(previousScene.entities ?? {}),
    ]);
    for (const entityId of entityIds) {
      if (JSON.stringify(currentScene.entities?.[entityId]) !== JSON.stringify(previousScene.entities?.[entityId])) {
        domains.add('entity');
        focusKeys.add(`entity:${sceneId}:${entityId}`);
        addEntityRelatedFocusKeys(focusKeys, sceneId, currentScene.entities?.[entityId] ?? previousScene.entities?.[entityId]);
      }
    }

    addListDiffFocus(domains, focusKeys, 'collision-rules', `collision-rule:${sceneId}`, currentScene.collisionRules, previousScene.collisionRules);
    addListDiffFocus(domains, focusKeys, 'triggers', `trigger:${sceneId}`, currentScene.triggers, previousScene.triggers);

    const changedAttachments = addRecordDiffFocus(
      domains,
      focusKeys,
      'attachments',
      `attachment:${sceneId}`,
      currentScene.attachments,
      previousScene.attachments,
    );
    changedAttachments.forEach((attachmentId) => {
      addAttachmentRelatedFocusKeys(
        focusKeys,
        sceneId,
        currentScene.attachments?.[attachmentId] ?? previousScene.attachments?.[attachmentId],
      );
    });

    const changedEventBlocks = addRecordDiffFocus(
      domains,
      focusKeys,
      'event-blocks',
      `event-block:${sceneId}`,
      currentScene.eventBlocks,
      previousScene.eventBlocks,
    );
    changedEventBlocks.forEach((eventBlockId) => {
      addEventBlockRelatedFocusKeys(
        focusKeys,
        sceneId,
        currentScene.eventBlocks?.[eventBlockId] ?? previousScene.eventBlocks?.[eventBlockId],
      );
    });

    const changedBehaviors = addRecordDiffFocus(
      domains,
      focusKeys,
      'behaviors',
      `behavior:${sceneId}`,
      currentScene.behaviors,
      previousScene.behaviors,
    );
    changedBehaviors.forEach((behaviorId) => {
      addBehaviorRelatedFocusKeys(
        focusKeys,
        sceneId,
        currentScene.behaviors?.[behaviorId] ?? previousScene.behaviors?.[behaviorId],
      );
    });

    addRecordDiffFocus(domains, focusKeys, 'actions', `action:${sceneId}`, currentScene.actions, previousScene.actions);
    addRecordDiffFocus(domains, focusKeys, 'conditions', `condition:${sceneId}`, currentScene.conditions, previousScene.conditions);

    if (JSON.stringify(currentScene.ambience ?? []) !== JSON.stringify(previousScene.ambience ?? [])) {
      domains.add('ambience');
      addSceneAssetFocusKeys(focusKeys, sceneId, currentScene);
      addSceneAssetFocusKeys(focusKeys, sceneId, previousScene);
    }

    if (JSON.stringify(currentScene.input ?? undefined) !== JSON.stringify(previousScene.input ?? undefined)) {
      domains.add('scene-input');
      addSceneInputRelatedFocusKeys(focusKeys, sceneId, currentScene.input);
      addSceneInputRelatedFocusKeys(focusKeys, sceneId, previousScene.input);
    }
  }

  return {
    domains,
    focusKeys,
    clusterKeys: buildClusterKeys(focusKeys),
  };
}

function parseRevisionTimestamp(updatedAt: string): number | null {
  const value = new Date(updatedAt).valueOf();
  return Number.isFinite(value) ? value : null;
}

function shouldCoalesceAutosaveRevision(
  previousBurstRevision: ProjectRevisionRecord | undefined,
  latestRevision: ProjectRevisionRecord | undefined,
  nextRevision: ProjectRevisionRecord,
  burstHistory: ProjectRevisionRecord[],
  nextHistory: ProjectRevisionRecord[],
): boolean {
  if (!latestRevision) return false;
  if (latestRevision.reason !== 'autosave' || nextRevision.reason !== 'autosave') return false;

  const latestAt = parseRevisionTimestamp(latestRevision.updatedAt);
  const nextAt = parseRevisionTimestamp(nextRevision.updatedAt);
  if (latestAt == null || nextAt == null || nextAt - latestAt > 90_000) return false;

  const overlappingBurstIds = (latestRevision.historyBurstIds ?? []).some((burstId) => (
    (nextRevision.historyBurstIds ?? []).includes(burstId)
  ));
  if (overlappingBurstIds) return true;

  const burstProfile = buildRevisionChangeProfile(latestRevision, previousBurstRevision, burstHistory);
  const nextProfile = buildRevisionChangeProfile(nextRevision, latestRevision, nextHistory);
  if (burstProfile.domains.size === 0 || nextProfile.domains.size === 0) return false;

  const combinedDomains = new Set([...burstProfile.domains, ...nextProfile.domains]);
  const includesMilestoneDomain = [...combinedDomains].some((domain) => REVISION_MILESTONE_DOMAINS.has(domain));
  const allowsMilestoneBlend = isAllowedRevisionMilestoneBlend(combinedDomains);

  if (includesMilestoneDomain && combinedDomains.size > 1 && !allowsMilestoneBlend) {
    return false;
  }
  const overlappingFocus = [...nextProfile.focusKeys].some((key) => burstProfile.focusKeys.has(key));
  if (overlappingFocus) return true;

  const overlappingClusters = [...nextProfile.clusterKeys].some((key) => burstProfile.clusterKeys.has(key));
  if (overlappingClusters) return true;

  if (combinedDomains.size === 1) {
    if (burstProfile.clusterKeys.size > 0 || nextProfile.clusterKeys.size > 0) return false;
    return true;
  }

  if (isAllowedRevisionDomainBlend(combinedDomains)) return true;
  if (allowsMilestoneBlend) return true;

  return false;
}

export function appendProjectRevision(
  revisions: ProjectRevisionRecord[] | undefined,
  nextRevision: ProjectRevisionRecord,
  limit: number = 25
): ProjectRevisionRecord[] {
  const existing = Array.isArray(revisions) ? revisions : [];
  const withoutDuplicate = existing.filter((revision) => revision.id !== nextRevision.id);
  const latestRevision = withoutDuplicate[0];
  const nextProject = materializeRevisionProjectWithBase(nextRevision);
  const latestProject = latestRevision ? materializeProjectRevision(withoutDuplicate, latestRevision.id) : null;
  const compactRevision = latestRevision
    ? {
      ...nextRevision,
      kind: 'delta' as const,
      baseRevisionId: latestRevision.id,
      patch: diffProjectValue(nextProject, latestProject),
      project: undefined,
    }
    : nextRevision;
  const previousBurstRevision = withoutDuplicate[1];
  const mergedHistoryEventIds = latestRevision
    ? Array.from(new Set([...(latestRevision.historyEventIds ?? []), ...(nextRevision.historyEventIds ?? [])]))
    : [...(nextRevision.historyEventIds ?? [])];
  const mergedHistoryBurstIds = latestRevision
    ? Array.from(new Set([...(latestRevision.historyBurstIds ?? []), ...(nextRevision.historyBurstIds ?? [])]))
    : [...(nextRevision.historyBurstIds ?? [])];
  if (shouldCoalesceAutosaveRevision(
    previousBurstRevision,
    latestRevision,
    nextRevision,
    withoutDuplicate,
    [nextRevision, ...withoutDuplicate],
  )) {
    if (!previousBurstRevision) {
      return [{
        ...nextRevision,
        historyEventIds: mergedHistoryEventIds.length > 0 ? mergedHistoryEventIds : undefined,
        historyBurstIds: mergedHistoryBurstIds.length > 0 ? mergedHistoryBurstIds : undefined,
      }, ...withoutDuplicate.slice(1)].slice(0, limit);
    }
    const previousBurstProject = materializeProjectRevision(withoutDuplicate, previousBurstRevision.id);
    const coalescedRevision: ProjectRevisionRecord = {
      ...nextRevision,
      kind: 'delta',
      baseRevisionId: previousBurstRevision.id,
      patch: diffProjectValue(nextProject, previousBurstProject),
      historyEventIds: mergedHistoryEventIds.length > 0 ? mergedHistoryEventIds : undefined,
      historyBurstIds: mergedHistoryBurstIds.length > 0 ? mergedHistoryBurstIds : undefined,
      project: undefined,
    };
    return [coalescedRevision, ...withoutDuplicate.slice(1)].slice(0, limit);
  }
  return [compactRevision, ...withoutDuplicate].slice(0, limit);
}
