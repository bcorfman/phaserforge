import { useEditorStore } from './EditorStore';

export function JsonPanel() {
  const { state, dispatch } = useEditorStore();

  return (
    <div className="panel json-panel" data-testid="json-panel">
      <div className="panel-title">Scene JSON</div>
      <textarea
        aria-label="Scene JSON"
        className="json-textarea"
        data-testid="json-textarea"
        value={state.jsonText}
        onChange={(e) => dispatch({ type: 'set-json-text', value: e.target.value })}
        placeholder="Click Export JSON to populate, edit, then Load JSON."
      />
    </div>
  );
}
