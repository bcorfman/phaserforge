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

function revisionReasonLabel(reason: ProjectRevisionRecord['reason']): string {
  switch (reason) {
    case 'protective':
      return 'Safety checkpoint';
    case 'restore':
      return 'Restored revision';
    case 'autosave':
    default:
      return 'Autosave checkpoint';
  }
}

function summarizeRevisionContent(revision: ProjectRevisionRecord): { entityCount?: number; initialSceneLabel?: string } {
  if (typeof revision.entityCount === 'number' && revision.initialSceneLabel) {
    return {
      entityCount: revision.entityCount,
      initialSceneLabel: revision.initialSceneLabel,
    };
  }
  try {
    const project = parseProjectYaml(revision.yaml);
    return {
      entityCount: Object.values(project.scenes ?? {}).reduce(
        (total, scene) => total + Object.keys(scene.entities ?? {}).length,
        0,
      ),
      initialSceneLabel: project.sceneMeta?.[project.initialSceneId]?.name?.trim() || project.initialSceneId,
    };
  } catch {
    return {
      entityCount: revision.entityCount,
      initialSceneLabel: revision.initialSceneLabel,
    };
  }
}

export function formatProjectRevisionTimestamp(revision: ProjectRevisionRecord): string {
  return shortMonthDayTime(revision.updatedAt);
}

export function formatProjectRevisionSummary(revision: ProjectRevisionRecord): string {
  const { entityCount, initialSceneLabel } = summarizeRevisionContent(revision);
  const sceneLabel = revision.sceneCount === 1 ? '1 scene' : `${revision.sceneCount} scenes`;
  const entityLabel = typeof entityCount === 'number'
    ? `${entityCount} ${entityCount === 1 ? 'entity' : 'entities'}`
    : undefined;
  const detailLabel = initialSceneLabel ? `Start: ${initialSceneLabel}` : undefined;
  return [
    revisionReasonLabel(revision.reason),
    sceneLabel,
    entityLabel,
    detailLabel,
  ].filter(Boolean).join(' · ');
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
