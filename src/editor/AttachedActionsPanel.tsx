import { useMemo } from 'react';
import type { EditorRegistryConfig, Id, SceneSpec, TargetRef } from '../model/types';
import { getAttachmentsForTarget } from './attachmentCommands';

const SUPPORTED_PRESETS = new Set(['MoveUntil', 'Wait', 'Call', 'Repeat']);

export function AttachedActionsPanel({
  scene,
  target,
  selectedAttachmentId,
  registry,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
}: {
  scene: SceneSpec;
  target: TargetRef;
  selectedAttachmentId?: Id;
  registry: EditorRegistryConfig;
  onAddAttachment: (presetId: string) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
}) {
  const attachments = getAttachmentsForTarget(scene, target);
  const supportedPresetEntries = useMemo(
    () => registry.actions.filter((entry) => entry.implemented && SUPPORTED_PRESETS.has(entry.type)),
    [registry.actions]
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
      {attachments.length === 0 && <div className="muted">No attached actions yet.</div>}
      <div className="member-list">
        {attachments.map((attachment, index) => (
          <div key={attachment.id} className="member-row">
            <button
              className="tag-button"
              data-testid={`attachment-open-${attachment.id}`}
              type="button"
              onClick={() => onSelectAttachment(attachment.id)}
            >
              {selectedAttachmentId === attachment.id ? 'Selected' : `Step ${index + 1}`} · {attachment.name ?? attachment.id} · {attachment.presetId}
            </button>
            <button
              className="tag-button"
              data-testid={`attachment-move-up-${attachment.id}`}
              disabled={index === 0}
              type="button"
              onClick={() => onMoveAttachment(attachment.id, 'up')}
            >
              Up
            </button>
            <button
              className="tag-button"
              data-testid={`attachment-move-down-${attachment.id}`}
              disabled={index === attachments.length - 1}
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
        ))}
      </div>
    </div>
  );
}

