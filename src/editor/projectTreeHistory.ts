import type { Id, ProjectSpec } from '../model/types';
import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';

export type SidebarScope = 'projectTree' | 'projectRevisions' | 'scene' | 'project';

export type ProjectRevisionRecord = {
  id: string;
  projectId: string;
  title: string;
  yaml: string;
  updatedAt: string;
  sceneCount: number;
  entityCount?: number;
  initialSceneLabel?: string;
  reason: 'autosave' | 'protective' | 'restore';
};

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

function summarizeRevisionContent(revision: ProjectRevisionRecord): RevisionSnapshot {
  if (typeof revision.entityCount === 'number' && revision.initialSceneLabel) {
    const title = revision.title?.trim() || 'Untitled Project';
    try {
      const project = parseProjectYaml(revision.yaml);
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
        title: project.title?.trim() || title,
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
    } catch {
      return {
        title,
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
  }
  const title = revision.title?.trim() || 'Untitled Project';
  try {
    const project = parseProjectYaml(revision.yaml);
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
      title: project.title?.trim() || title,
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
  } catch {
    return {
      title,
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

function formatAudioLibraryDiff(current: RevisionSnapshot, previous: RevisionSnapshot): string | null {
  const addedSoundIds = [...current.soundLabelsById.keys()].filter((assetId) => !previous.soundLabelsById.has(assetId));
  const removedSoundIds = [...previous.soundLabelsById.keys()].filter((assetId) => !current.soundLabelsById.has(assetId));
  if (addedSoundIds.length === 0 && removedSoundIds.length === 0) return null;
  if (addedSoundIds.length === 1 && removedSoundIds.length === 0) {
    return `Added audio ${current.soundLabelsById.get(addedSoundIds[0]) ?? addedSoundIds[0]}`;
  }
  if (removedSoundIds.length === 1 && addedSoundIds.length === 0) {
    return `Removed audio ${previous.soundLabelsById.get(removedSoundIds[0]) ?? removedSoundIds[0]}`;
  }
  if (addedSoundIds.length > 0 && removedSoundIds.length === 0) {
    return formatCountLabel(addedSoundIds.length, 'audio asset added', 'audio assets added');
  }
  if (removedSoundIds.length > 0 && addedSoundIds.length === 0) {
    return formatCountLabel(removedSoundIds.length, 'audio asset removed', 'audio assets removed');
  }
  return `Audio +${addedSoundIds.length}, -${removedSoundIds.length}`;
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

export function formatProjectRevisionTimestamp(revision: ProjectRevisionRecord): string {
  return shortMonthDayTime(revision.updatedAt);
}

export function formatProjectRevisionSummary(revision: ProjectRevisionRecord, previousRevision?: ProjectRevisionRecord): string {
  const current = summarizeRevisionContent(revision);
  if (!previousRevision) {
    const sceneLabel = current.sceneCount === 1 ? '1 scene' : `${current.sceneCount} scenes`;
    const entityLabel = typeof current.entityCount === 'number'
      ? `${current.entityCount} ${current.entityCount === 1 ? 'entity' : 'entities'}`
      : undefined;
    return ['Initial snapshot', sceneLabel, entityLabel].filter(Boolean).join(' · ');
  }

  const previous = summarizeRevisionContent(previousRevision);
  const specificChanges = [
    current.title !== previous.title ? `Renamed to ${current.title}` : null,
    formatSceneRenameDiff(current, previous),
    formatSceneDiff(current, previous),
    current.initialSceneId && previous.initialSceneId && current.initialSceneId !== previous.initialSceneId
      ? `Start scene -> ${current.initialSceneLabel ?? current.initialSceneId}`
      : null,
    formatEntityDiff(current, previous),
    formatAudioLibraryDiff(current, previous),
    formatSceneMusicDiff(current, previous),
    formatEntityEditDiff(current, previous),
    revision.reason === 'restore' ? 'Restored older version' : null,
    revision.reason === 'protective' ? 'Safety checkpoint' : null,
  ].filter((value): value is string => Boolean(value));

  if (specificChanges.length > 0) return specificChanges.slice(0, 2).join(' · ');
  const namedTriggerChange = formatNamedTriggerDiff(current, previous);
  if (namedTriggerChange) return namedTriggerChange;
  const sceneSystemChange = formatSceneSystemDiff(current, previous);
  if (sceneSystemChange) return sceneSystemChange;
  const broadSceneChange = formatSceneEditDiff(current, previous);
  if (broadSceneChange) return broadSceneChange;
  const projectSystemChange = formatProjectSystemDiff(current, previous);
  if (projectSystemChange) return projectSystemChange;
  return revision.yaml !== previousRevision.yaml ? 'Updated project settings' : 'Minor edits';
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

export function createProjectRevision(
  project: ProjectSpec,
  options?: {
    id?: string;
    updatedAt?: string;
    reason?: ProjectRevisionRecord['reason'];
  }
): ProjectRevisionRecord {
  return {
    id: options?.id ?? `revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    title: project.title?.trim() || 'Untitled Project',
    yaml: serializeProjectToYaml(project),
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
    sceneCount: Object.keys(project.scenes ?? {}).length,
    entityCount: Object.values(project.scenes ?? {}).reduce(
      (total, scene) => total + Object.keys(scene.entities ?? {}).length,
      0,
    ),
    initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
    reason: options?.reason ?? 'autosave',
  };
}

type RevisionChangeProfile = {
  domains: Set<string>;
  focusKeys: Set<string>;
};

function buildRevisionChangeProfile(
  revision: ProjectRevisionRecord,
  previousRevision?: ProjectRevisionRecord,
): RevisionChangeProfile {
  if (!previousRevision) return { domains: new Set(), focusKeys: new Set() };
  const current = summarizeRevisionContent(revision);
  const previous = summarizeRevisionContent(previousRevision);
  const domains = new Set<string>();
  const focusKeys = new Set<string>();

  if (current.title !== previous.title) {
    domains.add('project-title');
    focusKeys.add('project-title');
  }

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

  const inputMapDiff = diffRecordKeys(current.project?.inputMaps, previous.project?.inputMaps);
  if (inputMapDiff.added.length + inputMapDiff.removed.length + inputMapDiff.changed.length > 0) {
    domains.add('input-maps');
    [...inputMapDiff.added, ...inputMapDiff.removed, ...inputMapDiff.changed].forEach((mapId) => focusKeys.add(`input-map:${mapId}`));
  }

  if (
    current.project?.publishTitle !== previous.project?.publishTitle
    || current.project?.publishGithubPagesRepo !== previous.project?.publishGithubPagesRepo
  ) {
    domains.add('publish');
    if (current.project?.publishTitle !== previous.project?.publishTitle) focusKeys.add('publish:title');
    if (current.project?.publishGithubPagesRepo !== previous.project?.publishGithubPagesRepo) focusKeys.add('publish:repo');
  }

  for (const [sceneId, currentScene] of current.scenesById.entries()) {
    const previousScene = previous.scenesById.get(sceneId);
    if (!previousScene) continue;

    const entityIds = new Set([
      ...Object.keys(currentScene.entities ?? {}),
      ...Object.keys(previousScene.entities ?? {}),
    ]);
    for (const entityId of entityIds) {
      if (JSON.stringify(currentScene.entities?.[entityId]) !== JSON.stringify(previousScene.entities?.[entityId])) {
        domains.add('entity');
        focusKeys.add(`entity:${sceneId}:${entityId}`);
      }
    }

    const triggerDiff = diffListById(currentScene.triggers, previousScene.triggers);
    if (triggerDiff.added.length + triggerDiff.removed.length + triggerDiff.changed.length > 0) {
      domains.add('triggers');
      [...triggerDiff.added, ...triggerDiff.removed, ...triggerDiff.changed].forEach((trigger) => {
        focusKeys.add(`trigger:${sceneId}:${trigger.id}`);
      });
    }
  }

  return { domains, focusKeys };
}

function parseRevisionTimestamp(updatedAt: string): number | null {
  const value = new Date(updatedAt).valueOf();
  return Number.isFinite(value) ? value : null;
}

function shouldCoalesceAutosaveRevision(
  previousBurstRevision: ProjectRevisionRecord | undefined,
  latestRevision: ProjectRevisionRecord | undefined,
  nextRevision: ProjectRevisionRecord,
): boolean {
  if (!latestRevision) return false;
  if (latestRevision.reason !== 'autosave' || nextRevision.reason !== 'autosave') return false;

  const latestAt = parseRevisionTimestamp(latestRevision.updatedAt);
  const nextAt = parseRevisionTimestamp(nextRevision.updatedAt);
  if (latestAt == null || nextAt == null || nextAt - latestAt > 90_000) return false;

  const burstProfile = buildRevisionChangeProfile(latestRevision, previousBurstRevision);
  const nextProfile = buildRevisionChangeProfile(nextRevision, latestRevision);
  if (burstProfile.domains.size === 0 || nextProfile.domains.size === 0) return false;

  const overlappingFocus = [...nextProfile.focusKeys].some((key) => burstProfile.focusKeys.has(key));
  if (overlappingFocus) return true;

  const combinedDomains = new Set([...burstProfile.domains, ...nextProfile.domains]);
  if (combinedDomains.size === 1) return true;

  const combinedDomainKey = [...combinedDomains].sort().join('|');
  return combinedDomainKey === 'audio|music';
}

export function appendProjectRevision(
  revisions: ProjectRevisionRecord[] | undefined,
  nextRevision: ProjectRevisionRecord,
  limit: number = 25
): ProjectRevisionRecord[] {
  const existing = Array.isArray(revisions) ? revisions : [];
  const withoutDuplicate = existing.filter((revision) => revision.id !== nextRevision.id);
  if (shouldCoalesceAutosaveRevision(withoutDuplicate[1], withoutDuplicate[0], nextRevision)) {
    return [nextRevision, ...withoutDuplicate.slice(1)].slice(0, limit);
  }
  return [nextRevision, ...withoutDuplicate].slice(0, limit);
}
