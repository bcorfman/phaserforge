import { useMemo, useState } from 'react';
import type { EditorRegistryConfig, Id, SceneSpec, TargetRef } from '../model/types';
import { type AttachedActionRow, buildAttachedActionRowsForTarget } from './attachmentCommands';

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
]);

export function AttachedActionsPanel({
  scene,
  target,
  selectedAttachmentId,
  registry,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
}: {
  scene: SceneSpec;
  target: TargetRef;
  selectedAttachmentId?: Id;
  registry: EditorRegistryConfig;
  onAddAttachment: (presetId: string) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down') => void;
}) {
  const rows = buildAttachedActionRowsForTarget(scene, target);
  const supportedPresetEntries = useMemo(
    () => registry.actions.filter((entry) => entry.implemented && SUPPORTED_PRESETS.has(entry.type)),
    [registry.actions]
  );
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

  return (
    <div className="inspector-block" data-testid="attached-actions-panel">
      <div className="inspector-title">Attached Actions</div>
      <div className="panel-heading">Add</div>
      <div className="member-tags">
        {supportedPresetEntries.map((entry) => (
          <button
            key={entry.type}
            className="tag-button"
            data-testid={`add-attachment-${entry.type}`}
            type="button"
            onClick={() => onAddAttachment(entry.type)}
          >
            {entry.displayName}
          </button>
        ))}
      </div>

      <div className="panel-heading">List</div>
      {rows.length === 0 && <div className="muted">No attached actions yet.</div>}
      {selectedCount > 0 && (
        <div className="inspector-row" data-testid="attached-actions-selection-bar">
          <span>{selectedCount} selected</span>{' '}
          {selectedParallelGroupId ? (
            <button className="tag-button" type="button" onClick={() => onUngroupParallel(selectedParallelGroupId)}>
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
                  {isExpanded ? '▾' : '▸'} Parallel Group · {row.attachments.length} actions
                </button>
                <button className="tag-button" type="button" onClick={() => onUngroupParallel(row.groupId)}>
                  Ungroup
                </button>
                <button
                  className="tag-button"
                  disabled={rowIndex === 0}
                  type="button"
                  onClick={() => onMoveParallelGroup(row.groupId, 'up')}
                >
                  Up
                </button>
                <button
                  className="tag-button"
                  disabled={rowIndex === rows.length - 1}
                  type="button"
                  onClick={() => onMoveParallelGroup(row.groupId, 'down')}
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
