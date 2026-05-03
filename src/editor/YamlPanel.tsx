import { useMemo, useRef } from 'react';
import { useEditorStore } from './EditorStore';
import { exportYamlToDisk } from './yamlFileExport';
import { getYamlFileHandle, getYamlFileSourceLabel, getYamlPickerStartIn, setYamlFileHandle, setYamlFileSourceLabel, setYamlPickerStartIn } from './yamlPickerState';

type FilePickerLike = (options?: unknown) => Promise<any>;

function getOpenFilePicker(): FilePickerLike | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as any).showOpenFilePicker;
  return typeof picker === 'function' ? (picker as FilePickerLike) : null;
}

async function readFileHandleText(handle: any): Promise<{ text: string; label: string }> {
  const file = await handle.getFile();
  const label = file?.name ? String(file.name) : 'picked file';
  return { text: await file.text(), label };
}

async function writeYamlToHandle(handle: any, yaml: string): Promise<void> {
  if (!handle || typeof handle.createWritable !== 'function') {
    throw new Error('File handle is not writable');
  }
  const writable = await handle.createWritable();
  await writable.write(yaml);
  await writable.close();
}

export function YamlPanel() {
  const { state, dispatch } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const yamlSourceLabel = useMemo(() => getYamlFileSourceLabel(), [state.statusMessage, state.yamlText]);
  const hasWritableHandle = Boolean(getYamlFileHandle() && typeof (getYamlFileHandle() as any).createWritable === 'function');

  const openFromPicker = async () => {
    dispatch({ type: 'set-error', error: undefined });

    const picker = getOpenFilePicker();
    if (picker) {
      try {
        const handles = await picker({
          multiple: false,
          types: [
            {
              description: 'YAML',
              accept: {
                'application/x-yaml': ['.yaml', '.yml'],
                'text/yaml': ['.yaml', '.yml'],
                'text/plain': ['.yaml', '.yml'],
              },
            },
          ],
          ...(getYamlPickerStartIn() ? { startIn: getYamlPickerStartIn() } : {}),
        });
        const handle = handles?.[0];
        if (handle) {
          setYamlPickerStartIn(handle);
          setYamlFileHandle(handle);
          const { text, label } = await readFileHandleText(handle);
          setYamlFileSourceLabel(label);
          dispatch({ type: 'load-yaml-text', text, sourceLabel: label });
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Fall back to <input type=file>.
      }
    }

    const input = fileInputRef.current;
    if (!input) {
      dispatch({ type: 'set-error', error: 'File picker unavailable' });
      return;
    }
    input.value = '';
    input.click();
  };

  const onFilePicked = async (file: File | null) => {
    dispatch({ type: 'set-error', error: undefined });
    if (!file) return;
    try {
      const text = await file.text();
      setYamlFileHandle(undefined);
      setYamlFileSourceLabel(file.name ?? 'picked file');
      dispatch({ type: 'load-yaml-text', text, sourceLabel: file.name ?? 'picked file' });
    } catch (err) {
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to open YAML' });
    }
  };

  const applyYamlText = () => {
    dispatch({ type: 'set-error', error: undefined });
    dispatch({ type: 'load-yaml' });
  };

  const saveToSameFile = async () => {
    dispatch({ type: 'set-error', error: undefined });
    const handle = getYamlFileHandle();
    if (!handle) {
      await saveAs();
      return;
    }
    try {
      await writeYamlToHandle(handle, state.yamlText);
      dispatch({ type: 'set-status', message: `Saved YAML: ${getYamlFileSourceLabel() ?? 'file'}`, expiresAt: Date.now() + 4000 });
    } catch (err) {
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to save YAML' });
    }
  };

  const saveAs = async () => {
    dispatch({ type: 'set-error', error: undefined });
    try {
      const result = await exportYamlToDisk(state.yamlText, { startIn: getYamlPickerStartIn() });
      if (result.kind === 'saved') {
        setYamlPickerStartIn(result.handle);
        setYamlFileHandle(result.handle);
        setYamlFileSourceLabel(getYamlFileSourceLabel() ?? 'scene.yaml');
        dispatch({ type: 'set-status', message: 'Saved YAML', expiresAt: Date.now() + 4000 });
      } else {
        setYamlFileHandle(undefined);
        dispatch({ type: 'set-status', message: 'Downloaded YAML', expiresAt: Date.now() + 4000 });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to save YAML' });
    }
  };

  return (
    <div className="panel json-panel" data-testid="yaml-panel">
      <div className="panel-header">
        <p className="eyebrow">Serialization</p>
        <h2 className="panel-title">Scene YAML</h2>
        <p className="panel-description">
          Open YAML from disk, edit it here, then load it into the editor. Save writes the YAML text back to the current file.
        </p>
        <div className="toolbar-right-top" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
          <label className="toolbar-field" style={{ minWidth: 0, maxWidth: 260 }}>
            <span>Startup</span>
            <select
              aria-label="Startup mode"
              data-testid="startup-mode-select"
              value={state.startupMode}
              onChange={(e) => dispatch({ type: 'set-startup-mode', startupMode: e.target.value as typeof state.startupMode })}
            >
              <option value="reload_last_yaml">Reload Last YAML</option>
              <option value="new_empty_scene">New Empty Scene</option>
            </select>
          </label>
        </div>

        <div className="toolbar-actions" role="toolbar" aria-label="YAML actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
          <button className="button" type="button" data-testid="yaml-open-button" onClick={() => void openFromPicker()}>
            Open…
          </button>
          <button className="button" type="button" data-testid="yaml-load-button" onClick={applyYamlText} disabled={!state.yamlText.trim()}>
            Load
          </button>
          <button className="button" type="button" data-testid="yaml-save-button" onClick={() => void saveToSameFile()} disabled={!state.yamlText.trim()}>
            Save
          </button>
          <button className="button" type="button" data-testid="yaml-save-as-button" onClick={() => void saveAs()} disabled={!state.yamlText.trim()}>
            Save As…
          </button>
          {yamlSourceLabel && (
            <div className="muted" style={{ alignSelf: 'center' }}>
              File: <span className="mono">{yamlSourceLabel}</span>{hasWritableHandle ? '' : ' (read-only)'}
            </div>
          )}
        </div>
      </div>

      <textarea
        aria-label="Scene YAML"
        className="json-textarea"
        data-testid="yaml-textarea"
        value={state.yamlText}
        onChange={(e) => dispatch({ type: 'set-yaml-text', value: e.target.value })}
        placeholder="Open a YAML file, edit, then click Load."
      />

      <input
        aria-hidden="true"
        data-testid="yaml-open-file-input"
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,application/x-yaml,text/yaml,text/plain"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          e.currentTarget.value = '';
          await onFilePicked(file);
        }}
      />
    </div>
  );
}

