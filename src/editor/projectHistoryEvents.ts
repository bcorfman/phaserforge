import type { ProjectRevisionRecord } from './projectTreeHistory';

export type ProjectHistoryEventReason = 'autosave' | 'protective' | 'restore' | 'manual';

export type ProjectHistoryEventKind =
  | 'project.renamed'
  | 'publish.title.set'
  | 'publish.repo.set'
  | 'project.default-input-map.set'
  | 'asset.image.added'
  | 'asset.audio.added'
  | 'asset.font.added'
  | 'asset.spritesheet.added'
  | 'asset.renamed'
  | 'asset.removed'
  | 'scene.world.resized'
  | 'scene.renamed'
  | 'scene.created'
  | 'scene.duplicated'
  | 'scene.deleted'
  | 'scene.music.set'
  | 'scene.ambience.set'
  | 'scene.input.set'
  | 'background.layers.set'
  | 'background.layer.asset.set'
  | 'background.layer.updated'
  | 'background.layers.reordered'
  | 'background.layer.removed'
  | 'collision.rule.added'
  | 'collision.rule.updated'
  | 'collision.rule.removed'
  | 'trigger.added'
  | 'trigger.updated'
  | 'trigger.removed'
  | 'input.map.created'
  | 'input.map.duplicated'
  | 'input.map.removed'
  | 'input.binding.added'
  | 'input.binding.removed'
  | 'entity.asset.set'
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

export function partitionHistoryEventsByRevisionIds(
  historyEvents: ProjectHistoryEvent[] | undefined,
  revisionIds: string[] | Set<string>,
): {
  matched: ProjectHistoryEvent[];
  remaining: ProjectHistoryEvent[];
} {
  const events = historyEvents ?? [];
  const revisionIdSet = revisionIds instanceof Set ? revisionIds : new Set(revisionIds);
  const matched: ProjectHistoryEvent[] = [];
  const remaining: ProjectHistoryEvent[] = [];
  events.forEach((event) => {
    if (event.revisionId && revisionIdSet.has(event.revisionId)) {
      matched.push(event);
      return;
    }
    remaining.push(event);
  });
  return { matched, remaining };
}
