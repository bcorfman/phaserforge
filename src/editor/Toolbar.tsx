import { useEditorStore } from './EditorStore';

export function Toolbar() {
  const { state, dispatch } = useEditorStore();

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
        <div className="toolbar-actions" role="toolbar" aria-label="Studio actions">
        <button
          aria-label="Toggle play mode"
          className={`button ${state.mode === 'play' ? 'active' : ''}`}
          data-testid="toggle-mode-button"
          type="button"
          onClick={() => dispatch({ type: 'toggle-mode' })}
        >
          {state.mode === 'edit' ? 'Preview' : 'Edit Mode'}
        </button>
        <button
          aria-label="Export scene YAML"
          className="button"
          data-testid="export-yaml-button"
          type="button"
          onClick={() => dispatch({ type: 'export-yaml' })}
        >
          Export YAML
        </button>
        <button
          aria-label="Load scene YAML"
          className="button"
          data-testid="load-yaml-button"
          type="button"
          onClick={() => dispatch({ type: 'load-yaml' })}
        >
          Load YAML
        </button>
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
      </div>
      {state.error && <div className="toolbar-error" data-testid="toolbar-error" role="alert">{state.error}</div>}
    </header>
  );
}
