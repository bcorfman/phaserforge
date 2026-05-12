import { useMemo, useState } from 'react';
import type { AttachmentSpec, EditorRegistryConfig, EventBlockSpec, Id, ProjectSpec, SceneSpec, TargetRef } from '../model/types';
import { type AttachedActionRow, buildAttachedActionRowsForTargetAndEvent } from './attachmentCommands';

const SUPPORTED_PRESETS = new Set([
  'MoveUntil',
  'MoveXUntil',
  'MoveYUntil',
  'Wait',
  'Call',
  'Repeat',
  'BlinkUntil',
  'CallbackUntil',
  'CycleFramesUntil',
  'AddToCounter',
  'SetCounter',
  'ClampCounter',
  'AddSelfToCollection',
  'RemoveSelfFromCollection',
]);

function targetsEqual(a: TargetRef, b: TargetRef): boolean {
  if (a.type !== b.type) return false;
  return a.type === 'entity'
    ? a.entityId === (b as any).entityId
    : a.groupId === (b as any).groupId;
}

function listInputActionIds(project: ProjectSpec): string[] {
  const ids = new Set<string>();
  for (const map of Object.values(project.inputMaps ?? {})) {
    for (const id of Object.keys(map.actions ?? {})) ids.add(id);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

export function EventsPanel({
  project,
  scene,
  target,
  selectedAttachmentId,
  registry,
  onCreateEventBlock,
  onUpdateEventBlock,
  onRemoveEventBlock,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
}: {
  project: ProjectSpec;
  scene: SceneSpec;
  target: TargetRef;
  selectedAttachmentId?: Id;
  registry: EditorRegistryConfig;
  onCreateEventBlock: () => void;
  onUpdateEventBlock: (next: EventBlockSpec) => void;
  onRemoveEventBlock: (eventId: Id) => void;
  onAddAttachment: (presetId: string, init: Partial<AttachmentSpec>) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
}) {
  const eventBlocks = useMemo(() => {
    const blocks = Object.values(scene.eventBlocks ?? {}).filter((b) => targetsEqual((b as any).target, target)) as EventBlockSpec[];
    return blocks.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [scene.eventBlocks, target]);

  const supportedPresetEntries = useMemo(
    () => registry.actions.filter((entry) => entry.implemented && SUPPORTED_PRESETS.has(entry.type)),
    [registry.actions]
  );

  const inputActionIds = useMemo(() => listInputActionIds(project), [project]);

  return (
    <div className="inspector-block" data-testid="events-panel">
      <div className="inspector-title">Events</div>
      <div className="inspector-row">
        <button className="button" data-testid="add-event-block" type="button" onClick={onCreateEventBlock}>
          + Add Event
        </button>
      </div>
      <EventBlockCard
        key="__legacy__"
        block={{ id: '__legacy__', name: 'On Start (Legacy)', target, trigger: { type: 'start' } } as any}
        project={project}
        scene={scene}
        target={target}
        supportedPresetEntries={supportedPresetEntries}
        selectedAttachmentId={selectedAttachmentId}
        inputActionIds={inputActionIds}
        onUpdateEventBlock={() => {}}
        onRemoveEventBlock={() => {}}
        onAddAttachment={(presetId, init) => onAddAttachment(presetId, { ...init, eventId: undefined })}
        onSelectAttachment={onSelectAttachment}
        onMoveAttachment={onMoveAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onMakeParallel={onMakeParallel}
        onUngroupParallel={(groupId) => onUngroupParallel(groupId, undefined)}
        onMoveParallelGroup={(groupId, direction) => onMoveParallelGroup(groupId, direction, undefined)}
        hideEventControls
        eventIdForRows={undefined}
      />

      {eventBlocks.length === 0 && <div className="muted">No custom events yet. Add an event to start building event-driven behaviors.</div>}
      {eventBlocks.map((block) => (
        <EventBlockCard
          key={block.id}
          block={block}
          project={project}
          scene={scene}
          target={target}
          supportedPresetEntries={supportedPresetEntries}
          selectedAttachmentId={selectedAttachmentId}
          inputActionIds={inputActionIds}
          onUpdateEventBlock={onUpdateEventBlock}
          onRemoveEventBlock={onRemoveEventBlock}
          onAddAttachment={onAddAttachment}
          onSelectAttachment={onSelectAttachment}
          onMoveAttachment={onMoveAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onMakeParallel={onMakeParallel}
          onUngroupParallel={onUngroupParallel}
          onMoveParallelGroup={onMoveParallelGroup}
          eventIdForRows={block.id}
        />
      ))}
    </div>
  );
}

function EventBlockCard({
  block,
  project,
  scene,
  target,
  supportedPresetEntries,
  selectedAttachmentId,
  inputActionIds,
  onUpdateEventBlock,
  onRemoveEventBlock,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
  hideEventControls,
  eventIdForRows,
}: {
  block: EventBlockSpec;
  project: ProjectSpec;
  scene: SceneSpec;
  target: TargetRef;
  supportedPresetEntries: Array<{ type: string; displayName: string }>;
  selectedAttachmentId?: Id;
  inputActionIds: string[];
  onUpdateEventBlock: (next: EventBlockSpec) => void;
  onRemoveEventBlock: (eventId: Id) => void;
  onAddAttachment: (presetId: string, init: Partial<AttachmentSpec>) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
  hideEventControls?: boolean;
  eventIdForRows: Id | undefined;
}) {
  const trigger = block.trigger ?? { type: 'start' as const };
  const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<Id>>(() => new Set());
  const [selectedParallelGroupId, setSelectedParallelGroupId] = useState<string | null>(null);
  const [expandedParallelGroups, setExpandedParallelGroups] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedParallelGroupId ? 1 : selectedAttachmentIds.size;
  const clearSelection = () => {
    setSelectedAttachmentIds(new Set());
    setSelectedParallelGroupId(null);
  };
  const toggleSelected = (id: Id) => {
    setSelectedParallelGroupId(null);
    setSelectedAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExpanded = (groupId: string) => {
    setExpandedParallelGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const removeSelected = () => {
    if (selectedParallelGroupId) {
      const group = rows.find((r) => r.kind === 'parallel-group' && r.groupId === selectedParallelGroupId);
      if (group && group.kind === 'parallel-group') {
        for (const attachment of group.attachments) onRemoveAttachment(attachment.id);
      }
      clearSelection();
      return;
    }
    for (const id of selectedAttachmentIds) onRemoveAttachment(id);
    clearSelection();
  };

  const renderAttachmentRow = (
    attachment: any,
    indexLabel: string,
    opts: { disableUp: boolean; disableDown: boolean }
  ) => (
    <div key={attachment.id} className="member-row">
      <input
        aria-label={`Select attachment ${attachment.id}`}
        checked={selectedAttachmentIds.has(attachment.id)}
        onChange={() => toggleSelected(attachment.id)}
        type="checkbox"
      />
      <button
        className="tag-button"
        data-testid={`attachment-open-${attachment.id}`}
        type="button"
        onClick={() => onSelectAttachment(attachment.id)}
      >
        {selectedAttachmentId === attachment.id ? 'Selected' : indexLabel} · {attachment.name ?? attachment.id} · {attachment.presetId}
      </button>
      <button
        className="tag-button"
        data-testid={`attachment-move-up-${attachment.id}`}
        disabled={opts.disableUp}
        type="button"
        onClick={() => onMoveAttachment(attachment.id, 'up')}
      >
        Up
      </button>
      <button
        className="tag-button"
        data-testid={`attachment-move-down-${attachment.id}`}
        disabled={opts.disableDown}
        type="button"
        onClick={() => onMoveAttachment(attachment.id, 'down')}
      >
        Down
      </button>
      <button
        className="tag-button tag-button-danger"
        data-testid={`attachment-remove-${attachment.id}`}
        type="button"
        onClick={() => onRemoveAttachment(attachment.id)}
      >
        Remove
      </button>
    </div>
  );

  const triggerType = trigger.type ?? 'start';
  const triggerEdge = trigger.edge ?? (triggerType === 'visible' ? 'shown' : triggerType === 'input_action' ? 'pressed' : undefined);
  const triggerActionId = trigger.actionId ?? (inputActionIds[0] ?? '');

  return (
    <div className="inspector-block" style={{ marginTop: 10 }} data-testid={`event-block-${block.id}`}>
      <div className="member-row" style={{ justifyContent: 'space-between' }}>
        <strong>{block.name ?? `Event ${block.id}`}</strong>
        {!hideEventControls && (
          <button className="tag-button tag-button-danger" type="button" onClick={() => onRemoveEventBlock(block.id)}>
            Remove Event
          </button>
        )}
      </div>
      {!hideEventControls && (
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Event Name"
            type="text"
            value={block.name ?? ''}
            onChange={(e) => onUpdateEventBlock({ ...block, name: e.target.value || undefined })}
          />
        </label>
      )}
      <div className="inspector-grid-2">
        {!hideEventControls ? (
          <label className="field">
            <span>Trigger</span>
            <select
              aria-label="Event Trigger"
              value={triggerType}
              onChange={(e) => {
                const type = e.target.value as any;
                if (type === 'start') onUpdateEventBlock({ ...block, trigger: { type: 'start' } });
                else if (type === 'update') onUpdateEventBlock({ ...block, trigger: { type: 'update' } });
                else if (type === 'visible') onUpdateEventBlock({ ...block, trigger: { type: 'visible', edge: 'shown' } });
                else onUpdateEventBlock({ ...block, trigger: { type: 'input_action', actionId: triggerActionId, edge: 'pressed' } });
              }}
            >
              <option value="start">On Start</option>
              <option value="update">On Update</option>
              <option value="input_action">On Input Action</option>
              <option value="visible">On Visible Changed</option>
            </select>
          </label>
        ) : (
          <div />
        )}

        {!hideEventControls && triggerType === 'input_action' ? (
          <label className="field">
            <span>Action</span>
            <select
              aria-label="Input Action Id"
              value={triggerActionId}
              onChange={(e) => onUpdateEventBlock({ ...block, trigger: { type: 'input_action', actionId: e.target.value, edge: (triggerEdge as any) ?? 'pressed' } })}
            >
              {inputActionIds.length === 0 && <option value="">(no input actions)</option>}
              {inputActionIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        ) : !hideEventControls && triggerType === 'visible' ? (
          <label className="field">
            <span>Edge</span>
            <select
              aria-label="Visible Edge"
              value={triggerEdge ?? 'shown'}
              onChange={(e) => onUpdateEventBlock({ ...block, trigger: { type: 'visible', edge: e.target.value as any } })}
            >
              <option value="shown">Shown</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        ) : <div />}
      </div>

      <div className="panel-heading">Add Action</div>
      <div className="member-tags">
        {supportedPresetEntries.map((entry) => (
          <button
            key={entry.type}
            className="tag-button"
            type="button"
            data-testid={hideEventControls ? `add-attachment-${entry.type}` : `add-event-attachment-${block.id}-${entry.type}`}
            onClick={() => {
              const init: Partial<AttachmentSpec> = { eventId: block.id };
              if (entry.type === 'Call') init.condition = { type: 'Instant' } as any;
              onAddAttachment(entry.type, init);
            }}
          >
            {entry.displayName}
          </button>
        ))}
      </div>

      <div className="panel-heading">Steps</div>
      {rows.length === 0 && <div className="muted">No actions yet.</div>}
      {selectedCount > 0 && (
        <div className="inspector-row" data-testid="event-actions-selection-bar">
          <span>{selectedCount} selected</span>{' '}
          {selectedParallelGroupId ? (
                <button className="tag-button" type="button" onClick={() => onUngroupParallel(selectedParallelGroupId, eventIdForRows ?? (block.id as any))}>
              Ungroup
            </button>
          ) : (
            selectedCount >= 2 && (
              <button
                className="tag-button"
                type="button"
                onClick={() => onMakeParallel(Array.from(selectedAttachmentIds))}
              >
                Make Parallel
              </button>
            )
          )}
          <button className="tag-button" type="button" onClick={() => clearSelection()}>
            Cancel
          </button>
          <button className="tag-button tag-button-danger" type="button" onClick={() => removeSelected()}>
            Remove
          </button>
        </div>
      )}

      <div className="member-list">
        {rows.map((row: AttachedActionRow, rowIndex: number) => {
          if (row.kind === 'attachment') {
            const indexLabel = `Step ${rowIndex + 1}`;
            return renderAttachmentRow(row.attachment, indexLabel, {
              disableUp: rowIndex === 0,
              disableDown: rowIndex === rows.length - 1,
            });
          }

          const isExpanded = expandedParallelGroups.has(row.groupId);
          return (
            <div key={`parallel-${row.groupId}`}>
              <div className="member-row">
                <input
                  aria-label={`Select parallel group ${row.groupId}`}
                  checked={selectedParallelGroupId === row.groupId}
                  onChange={() => {
                    setSelectedAttachmentIds(new Set());
                    setSelectedParallelGroupId((prev) => (prev === row.groupId ? null : row.groupId));
                  }}
                  type="checkbox"
                />
                <button className="tag-button" type="button" onClick={() => toggleExpanded(row.groupId)}>
                  {isExpanded ? '▾' : '▸'} Parallel · {row.attachments.length} actions
                </button>
                <button className="tag-button" type="button" onClick={() => onUngroupParallel(row.groupId, block.id)}>
                  Ungroup
                </button>
                <button
                  className="tag-button"
                  disabled={rowIndex === 0}
                  type="button"
                  onClick={() => onMoveParallelGroup(row.groupId, 'up', eventIdForRows ?? (block.id as any))}
                >
                  Up
                </button>
                <button
                  className="tag-button"
                  disabled={rowIndex === rows.length - 1}
                  type="button"
                  onClick={() => onMoveParallelGroup(row.groupId, 'down', eventIdForRows ?? (block.id as any))}
                >
                  Down
                </button>
              </div>
              {isExpanded &&
                row.attachments.map((attachment) => (
                  <div key={attachment.id} className="member-row" style={{ paddingLeft: 18 }}>
                    <button
                      className="tag-button"
                      type="button"
                      onClick={() => onSelectAttachment(attachment.id)}
                    >
                      • {attachment.name ?? attachment.id} · {attachment.presetId}
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
