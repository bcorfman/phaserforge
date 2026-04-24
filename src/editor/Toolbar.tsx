import { useRef } from 'react';
import { useEditorStore } from './EditorStore';
import { serializeProjectToYaml } from '../model/serialization';
import { exportYamlToDisk } from './yamlFileExport';
import { getYamlPickerStartIn, setYamlPickerStartIn } from './yamlPickerState';

export function Toolbar() {
  const { state, dispatch } = useEditorStore();
  const yamlFileInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);

  const readAsDataUrl = async (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });

  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="toolbar-left">
        <p className="toolbar-kicker">Browser Editor</p>
        <div className="toolbar-title-row">
          <h1 className="brand">PhaserActions Studio</h1>
          {state.dirty && <span className="badge" data-testid="dirty-badge">Unsaved</span>}
        </div>
        <p className="toolbar-summary">
          Move entities on the canvas, tune formations in the inspector, and round-trip YAML without leaving the editor.
        </p>
      </div>
      <div className="toolbar-right">
        <div className="toolbar-right-top">
          <label className="toolbar-field">
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
          <label className="toolbar-field toolbar-field-compact">
            <span>UI Scale</span>
            <div className="toolbar-slider-row">
              <input
                aria-label="UI Scale"
                data-testid="ui-scale-slider"
                className="toolbar-slider"
                type="range"
                min={0.75}
                max={1.1}
                step={0.05}
                value={state.uiScale}
                onChange={(e) => dispatch({ type: 'set-ui-scale', uiScale: Number(e.target.value) })}
              />
              <span className="toolbar-slider-value">{Math.round(state.uiScale * 100)}%</span>
            </div>
          </label>
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              aria-label="Use system theme"
              aria-pressed={state.themeMode === 'system'}
              className={`theme-button ${state.themeMode === 'system' ? 'active' : ''}`}
              data-testid="theme-mode-system"
              type="button"
              onClick={() => dispatch({ type: 'set-theme-mode', themeMode: 'system' })}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 5.75C4 4.7835 4.7835 4 5.75 4H18.25C19.2165 4 20 4.7835 20 5.75V15.25C20 16.2165 19.2165 17 18.25 17H5.75C4.7835 17 4 16.2165 4 15.25V5.75Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path d="M8 20H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M12 17V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <button
              aria-label="Use light theme"
              aria-pressed={state.themeMode === 'light'}
              className={`theme-button ${state.themeMode === 'light' ? 'active' : ''}`}
              data-testid="theme-mode-light"
              type="button"
              onClick={() => dispatch({ type: 'set-theme-mode', themeMode: 'light' })}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 2.5V5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M12 19V21.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M2.5 12H5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M19 12H21.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M4.6 4.6L6.35 6.35" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M17.65 17.65L19.4 19.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M4.6 19.4L6.35 17.65" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M17.65 6.35L19.4 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <button
              aria-label="Use dark theme"
              aria-pressed={state.themeMode === 'dark'}
              className={`theme-button ${state.themeMode === 'dark' ? 'active' : ''}`}
              data-testid="theme-mode-dark"
              type="button"
              onClick={() => dispatch({ type: 'set-theme-mode', themeMode: 'dark' })}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20.5 14.4C19.5 18.3 15.8 21.2 11.7 20.9C7.2 20.6 3.6 16.8 3.6 12.3C3.6 8.1 6.7 4.6 10.8 3.7C10.4 5.1 10.3 6.6 10.6 8C11.4 11.8 15 14.4 18.9 13.9C19.5 13.8 20 13.6 20.5 13.3V14.4Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="toolbar-actions toolbar-actions-bottom" role="toolbar" aria-label="Studio actions">
        <button
          aria-label="Add background layer"
          className="button"
          data-testid="add-background-button"
          type="button"
          disabled={state.mode !== 'edit'}
          onClick={() => backgroundFileInputRef.current?.click()}
        >
          Add Background
        </button>
        <input
          aria-hidden="true"
          ref={backgroundFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={async (e) => {
            dispatch({ type: 'set-error', error: undefined });
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            e.currentTarget.value = '';
            try {
              const dataUrl = await readAsDataUrl(file);
              dispatch({
                type: 'add-background-layer-from-file',
                file: { dataUrl, originalName: file.name, mimeType: file.type || undefined },
                defaults: { layout: 'cover' },
              });
            } catch (err) {
              dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to import background' });
            }
          }}
        />
        <button
          aria-label="Export scene YAML"
          className="button"
          data-testid="export-yaml-button"
          type="button"
          onClick={async () => {
            const yaml = serializeProjectToYaml(state.project);
            dispatch({ type: 'export-yaml' });
            try {
              const result = await exportYamlToDisk(yaml, { startIn: getYamlPickerStartIn() });
              if (result.kind === 'saved') setYamlPickerStartIn(result.handle);
            } catch (err) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to export YAML' });
            }
          }}
        >
          Export YAML
        </button>
        <button
          aria-label="Load project YAML"
          className="button"
          data-testid="load-yaml-button"
          type="button"
          onClick={async () => {
            dispatch({ type: 'set-error', error: undefined });
            try {
              if (typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function') {
                try {
                  const handles = await (window as any).showOpenFilePicker({
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
                    const file = await handle.getFile();
                    dispatch({ type: 'load-yaml-text', text: await file.text(), sourceLabel: file.name ?? 'picked file' });
                    return;
                  }
                } catch (err) {
                  if (err instanceof DOMException && err.name === 'AbortError') return;
                  // Fall back to input picker.
                }
              }

              const input = yamlFileInputRef.current;
              if (!input) {
                dispatch({ type: 'load-yaml-text', text: state.yamlText, sourceLabel: 'editor text' });
                return;
              }
              input.value = '';
              input.click();
            } catch (err) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to load YAML' });
            }
          }}
        >
          Load YAML
        </button>
        <input
          aria-hidden="true"
          data-testid="yaml-open-file-input"
          ref={yamlFileInputRef}
          type="file"
          accept=".yaml,.yml,application/x-yaml,text/yaml,text/plain"
          style={{ display: 'none' }}
          onChange={async (e) => {
            dispatch({ type: 'set-error', error: undefined });
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              dispatch({ type: 'load-yaml-text', text, sourceLabel: file.name });
            } catch (err) {
              dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to load YAML' });
            }
          }}
        />
        <button
          aria-label="Reset scene"
          className="button"
          data-testid="reset-scene-button"
          type="button"
          onClick={() => dispatch({ type: 'reset-scene' })}
        >
          New Scene
        </button>
      </div>
      {state.error && <div className="toolbar-error" data-testid="toolbar-error" role="alert">{state.error}</div>}
      {state.statusMessage && <div className="toolbar-status" data-testid="toolbar-status" role="status">{state.statusMessage}</div>}
    </header>
  );
}
