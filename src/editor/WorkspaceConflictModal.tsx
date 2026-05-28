import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceSummary, YamlWorkspaceSummary } from './workspaceSummary';

type WorkspaceSide = {
  kind: 'cloud' | 'device';
  label: string;
  lastSavedLabel: string;
  yamlText: string;
  parsed: YamlWorkspaceSummary;
};

function formatSummary(summary: WorkspaceSummary): string {
  return `Scenes: ${summary.scenes} • Entities: ${summary.entities} • Groups: ${summary.groups} • Assets: ${summary.assets}`;
}

export function WorkspaceConflictModal({
  cloud,
  device,
  onExportBoth,
  onChooseCloud,
  onChooseDevice,
  onClose,
}: {
  cloud: WorkspaceSide;
  device: WorkspaceSide;
  onExportBoth: () => void;
  onChooseCloud: () => void;
  onChooseDevice: () => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<WorkspaceSide | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (preview) setPreview(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, preview]);

  const previewLines = useMemo(() => {
    if (!preview) return [];
    if (!preview.parsed.ok) return [`Unable to preview: ${preview.parsed.error}`];
    const rows: string[] = [];
    rows.push(formatSummary(preview.parsed.summary));
    rows.push('');
    const parsed = preview.parsed;
    // Keep preview stable and short: canonical YAML header only.
    rows.push(...parsed.canonicalYaml.split('\n').slice(0, 80));
    if (parsed.canonicalYaml.split('\n').length > 80) rows.push('…');
    return rows;
  }, [preview]);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target !== overlayRef.current) return;
    if (preview) setPreview(null);
    else onClose();
  };

  return (
    <div
      className="modal-overlay workspace-conflict-modal"
      data-testid="workspace-conflict-modal"
      role="dialog"
      aria-label="Choose which workspace to keep"
      ref={overlayRef}
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-card">
        <div className="workspace-conflict-header">
          <div className="workspace-conflict-title">Choose which workspace to keep</div>
          <button className="button button-compact" type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="workspace-conflict-grid">
          <div className="workspace-conflict-side" data-testid="workspace-conflict-cloud-card">
            <div className="workspace-conflict-side-title">{cloud.label}</div>
            <div className="workspace-conflict-meta">Last saved: {cloud.lastSavedLabel}</div>
            <div className="workspace-conflict-summary">
              {cloud.parsed.ok ? formatSummary(cloud.parsed.summary) : 'Summary unavailable'}
            </div>
            <div className="workspace-conflict-actions">
              <button className="button" type="button" onClick={() => setPreview(cloud)}>
                Preview
              </button>
              <button className="button primary" type="button" data-testid="workspace-conflict-use-cloud" onClick={onChooseCloud}>
                Use Cloud
              </button>
            </div>
          </div>

          <div className="workspace-conflict-side" data-testid="workspace-conflict-device-card">
            <div className="workspace-conflict-side-title">{device.label}</div>
            <div className="workspace-conflict-meta">Last saved: {device.lastSavedLabel}</div>
            <div className="workspace-conflict-summary">
              {device.parsed.ok ? formatSummary(device.parsed.summary) : 'Summary unavailable'}
            </div>
            <div className="workspace-conflict-actions">
              <button className="button" type="button" onClick={() => setPreview(device)}>
                Preview
              </button>
              <button className="button primary" type="button" data-testid="workspace-conflict-use-device" onClick={onChooseDevice}>
                Use This Device
              </button>
            </div>
          </div>
        </div>

        <div className="workspace-conflict-footer">
          <button className="button" type="button" data-testid="workspace-conflict-export-both" onClick={onExportBoth}>
            Export both as YAML…
          </button>
        </div>

        {preview ? (
          <div className="modal-overlay workspace-conflict-preview-overlay" role="dialog" aria-label="Workspace preview">
            <div className="modal-card workspace-conflict-preview-card">
              <div className="workspace-conflict-header">
                <div className="workspace-conflict-title">Preview: {preview.label}</div>
                <button className="button button-compact" type="button" onClick={() => setPreview(null)} aria-label="Close preview">
                  Close
                </button>
              </div>
              <pre className="workspace-conflict-preview" data-testid="workspace-conflict-preview">
                {previewLines.join('\n')}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
