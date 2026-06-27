import type { ProjectRevisionRecord } from './projectTreeHistory';

export type ProjectHistoryEventReason = 'autosave' | 'protective' | 'restore' | 'manual';

export type ProjectHistoryEventKind =
  | 'project.renamed'
  | 'publish.title.set'
  | 'publish.repo.set'
  | 'scene.world.resized'
  | 'scene.renamed'
  | 'scene.created'
  | 'scene.duplicated'
  | 'scene.deleted'
  | 'entity.renamed'
  | 'entity.moved';

export type ProjectHistoryEventScope =
  | { kind: 'project' }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'entity'; sceneId: string; entityId: string };

export type ProjectHistoryEvent = {
  id: string;
  projectId: string;
  revisionId?: string;
  occurredAt: string;
  reason: ProjectHistoryEventReason;
  kind: ProjectHistoryEventKind;
  burstId?: string;
  scope: ProjectHistoryEventScope;
  summary: string;
  details?: string[];
  payload?: Record<string, unknown>;
};

export type ProjectHistoryEventDraft = {
  kind: ProjectHistoryEventKind;
  burstId?: string;
  scope: ProjectHistoryEventScope;
  summary: string;
  details?: string[];
  payload?: Record<string, unknown>;
};

export function materializeProjectHistoryEvents(
  drafts: ProjectHistoryEventDraft[] | undefined,
  options: {
    projectId: string;
    revision: Pick<ProjectRevisionRecord, 'id' | 'updatedAt' | 'reason'>;
  },
): ProjectHistoryEvent[] {
  if (!drafts || drafts.length === 0) return [];
  return drafts.map((draft, index) => ({
    id: `history-event-${options.revision.id}-${index}`,
    projectId: options.projectId,
    revisionId: options.revision.id,
    occurredAt: options.revision.updatedAt,
    reason: options.revision.reason,
    kind: draft.kind,
    burstId: draft.burstId,
    scope: structuredClone(draft.scope),
    summary: draft.summary,
    ...(draft.details?.length ? { details: [...draft.details] } : {}),
    ...(draft.payload ? { payload: structuredClone(draft.payload) } : {}),
  }));
}

export function collectRevisionHistoryEvents(
  revision: Pick<ProjectRevisionRecord, 'historyEventIds'>,
  historyEvents: ProjectHistoryEvent[] | undefined,
): ProjectHistoryEvent[] {
  if (!revision.historyEventIds?.length || !historyEvents?.length) return [];
  const ids = new Set(revision.historyEventIds);
  return historyEvents.filter((event) => ids.has(event.id));
}

export function buildRevisionEventDetailItems(
  revision: Pick<ProjectRevisionRecord, 'historyEventIds'>,
  historyEvents: ProjectHistoryEvent[] | undefined,
): string[] {
  const events = collectRevisionHistoryEvents(revision, historyEvents);
  if (events.length === 0) return [];
  return events.flatMap((event) => {
    if (event.details?.length) return event.details;
    return [event.summary];
  });
}
