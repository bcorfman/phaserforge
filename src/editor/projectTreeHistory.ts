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
  title: string;
  sceneCount: number;
  entityCount?: number;
  initialSceneId?: string;
  initialSceneLabel?: string;
  sceneLabelsById: Map<string, string>;
  entitySceneById: Map<string, string>;
};

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
      const entitySceneById = new Map<string, string>();
      Object.entries(project.scenes ?? {}).forEach(([sceneId, scene]) => {
        Object.keys(scene.entities ?? {}).forEach((entityId) => {
          entitySceneById.set(entityId, sceneId);
        });
      });
      return {
        title: project.title?.trim() || title,
        sceneCount: Object.keys(project.scenes ?? {}).length,
        entityCount: Object.values(project.scenes ?? {}).reduce(
          (total, scene) => total + Object.keys(scene.entities ?? {}).length,
          0,
        ),
        initialSceneId: project.initialSceneId,
        initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
        sceneLabelsById,
        entitySceneById,
      };
    } catch {
      return {
        title,
        sceneCount: revision.sceneCount,
        entityCount: revision.entityCount,
        initialSceneLabel: revision.initialSceneLabel,
        sceneLabelsById: new Map(),
        entitySceneById: new Map(),
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
    const entitySceneById = new Map<string, string>();
    Object.entries(project.scenes ?? {}).forEach(([sceneId, scene]) => {
      Object.keys(scene.entities ?? {}).forEach((entityId) => {
        entitySceneById.set(entityId, sceneId);
      });
    });
    return {
      title: project.title?.trim() || title,
      sceneCount: Object.keys(project.scenes ?? {}).length,
      entityCount: Object.values(project.scenes ?? {}).reduce(
        (total, scene) => total + Object.keys(scene.entities ?? {}).length,
        0,
      ),
      initialSceneId: project.initialSceneId,
      initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
      sceneLabelsById,
      entitySceneById,
    };
  } catch {
    return {
      title,
      sceneCount: revision.sceneCount,
      entityCount: revision.entityCount,
      initialSceneLabel: revision.initialSceneLabel,
      sceneLabelsById: new Map(),
      entitySceneById: new Map(),
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
  const changes = [
    current.title !== previous.title ? `Renamed to ${current.title}` : null,
    formatSceneDiff(current, previous),
    current.initialSceneId && previous.initialSceneId && current.initialSceneId !== previous.initialSceneId
      ? `Start scene -> ${current.initialSceneLabel ?? current.initialSceneId}`
      : null,
    formatEntityDiff(current, previous),
    revision.reason === 'restore' ? 'Restored older version' : null,
    revision.reason === 'protective' ? 'Safety checkpoint' : null,
  ].filter((value): value is string => Boolean(value));

  return changes.slice(0, 2).join(' · ') || 'Minor edits';
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

export function appendProjectRevision(
  revisions: ProjectRevisionRecord[] | undefined,
  nextRevision: ProjectRevisionRecord,
  limit: number = 25
): ProjectRevisionRecord[] {
  const existing = Array.isArray(revisions) ? revisions : [];
  const withoutDuplicate = existing.filter((revision) => revision.id !== nextRevision.id);
  return [nextRevision, ...withoutDuplicate].slice(0, limit);
}
