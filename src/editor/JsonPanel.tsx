import { useEditorStore } from './EditorStore';

export function JsonPanel() {
  const { state, dispatch } = useEditorStore();

  return (
    <div className="panel json-panel" data-testid="json-panel">
      <div className="panel-header">
        <p className="eyebrow">Serialization</p>
        <h2 className="panel-title">Scene YAML</h2>
        <p className="panel-description">
          Export the live scene, make structured edits, then load it back into the editor.
        </p>
      </div>
      <textarea
        aria-label="Scene YAML"
        className="json-textarea"
        data-testid="yaml-textarea"
        value={state.yamlText}
        onChange={(e) => dispatch({ type: 'set-yaml-text', value: e.target.value })}
        placeholder="Click Export YAML to populate, edit, then Load YAML."
      />
    </div>
  );
}
