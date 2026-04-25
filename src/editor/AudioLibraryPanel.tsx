import { useMemo, useRef, useState } from 'react';
import type { ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function AudioLibraryPanel({
  project,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const sounds = project.audio?.sounds ?? {};
  const soundIds = useMemo(() => Object.keys(sounds).sort(), [sounds]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pathDraft, setPathDraft] = useState('');

  const addFromFile = async (file: File) => {
    const dataUrl = await readAsDataUrl(file);
    dispatch({
      type: 'add-audio-asset-from-file',
      file: { dataUrl, originalName: file.name, mimeType: file.type || undefined },
    });
  };

  const addFromPath = () => {
    const path = pathDraft.trim();
    if (!path) return;
    dispatch({ type: 'add-audio-asset-from-path', path });
    setPathDraft('');
  };

  return (
    <section className="panel-section" aria-labelledby="audio-library">
      <div className="panel-heading-row">
        <h3 className="panel-heading" id="audio-library">Audio</h3>
      </div>

      {soundIds.length === 0 && (
        <div className="muted" style={{ padding: '6px 0' }}>
          No audio assets yet.
        </div>
      )}

      <div className="member-list">
        {soundIds.map((id) => (
          <div key={id} className="member-row">
            <div className="list-item" data-testid={`audio-asset-${id}`} style={{ flex: 1, textAlign: 'left', opacity: disabled ? 0.7 : 1 }}>
              {id}
            </div>
            <button
              aria-label={`Remove audio ${id}`}
              className="scene-graph-button scene-graph-remove"
              data-testid={`remove-audio-asset-${id}`}
              type="button"
              disabled={disabled}
              onClick={() => dispatch({ type: 'remove-audio-asset', assetId: id } as any)}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void addFromFile(file);
          e.currentTarget.value = '';
        }}
        data-testid="audio-file-input"
        disabled={disabled}
      />

      <button
        className="button"
        data-testid="add-audio-button"
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        + Add Audio
      </button>

      <div className="field" style={{ marginTop: 8 }}>
        <span>Asset Path</span>
        <input
          aria-label="Audio asset path"
          data-testid="audio-path-input"
          type="text"
          value={pathDraft}
          onChange={(e) => setPathDraft(e.target.value)}
          placeholder="/assets/audio/theme.mp3"
          disabled={disabled}
        />
        <button className="button" data-testid="add-audio-path-button" type="button" disabled={disabled} onClick={addFromPath}>
          Add
        </button>
      </div>
    </section>
  );
}

