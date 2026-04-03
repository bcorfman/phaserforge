import { useEditorStore } from './EditorStore';

export function Toolbar() {
  const { state, dispatch } = useEditorStore();

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="brand">PhaserActions Studio</span>
        {state.dirty && <span className="badge">Unsaved</span>}
      </div>
      <div className="toolbar-right">
        <button
          className={`button ${state.mode === 'play' ? 'active' : ''}`}
          type="button"
          onClick={() => dispatch({ type: 'toggle-mode' })}
        >
          {state.mode === 'edit' ? '▶️ Play' : '✏️ Edit'}
        </button>
        <button className="button" type="button" onClick={() => dispatch({ type: 'export-json' })}>
          Export JSON
        </button>
        <button className="button" type="button" onClick={() => dispatch({ type: 'load-json' })}>
          Load JSON
        </button>
        <button className="button" type="button" onClick={() => dispatch({ type: 'reset-scene' })}>
          Reset Sample
        </button>
      </div>
      {state.error && <div className="toolbar-error">{state.error}</div>}
    </div>
  );
}
