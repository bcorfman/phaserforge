import { useEditorStore } from './EditorStore';

export function Toolbar() {
  const { state, dispatch } = useEditorStore();

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-left">
        <span className="brand">PhaserActions Studio</span>
        {state.dirty && <span className="badge" data-testid="dirty-badge">Unsaved</span>}
      </div>
      <div className="toolbar-right">
        <button
          aria-label="Toggle play mode"
          className={`button ${state.mode === 'play' ? 'active' : ''}`}
          data-testid="toggle-mode-button"
          type="button"
          onClick={() => dispatch({ type: 'toggle-mode' })}
        >
          {state.mode === 'edit' ? '▶️ Play' : '✏️ Edit'}
        </button>
        <button
          aria-label="Export scene JSON"
          className="button"
          data-testid="export-json-button"
          type="button"
          onClick={() => dispatch({ type: 'export-json' })}
        >
          Export JSON
        </button>
        <button
          aria-label="Load scene JSON"
          className="button"
          data-testid="load-json-button"
          type="button"
          onClick={() => dispatch({ type: 'load-json' })}
        >
          Load JSON
        </button>
        <button
          aria-label="Reset sample scene"
          className="button"
          data-testid="reset-scene-button"
          type="button"
          onClick={() => dispatch({ type: 'reset-scene' })}
        >
          Reset Sample
        </button>
      </div>
      {state.error && <div className="toolbar-error" data-testid="toolbar-error">{state.error}</div>}
    </div>
  );
}
