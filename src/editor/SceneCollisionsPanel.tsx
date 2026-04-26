import type { CollisionRuleSpec, GameSceneSpec } from '../model/types';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';

function uniqueLayers(scene: GameSceneSpec): string[] {
  const layers = new Set<string>();
  for (const entity of Object.values(scene.entities)) {
    const layer = entity.collision?.layer;
    if (typeof layer === 'string' && layer.length > 0) layers.add(layer);
  }
  return Array.from(layers).sort();
}

export function SceneCollisionsPanel({
  scene,
  dispatch,
  disabled,
}: {
  scene: GameSceneSpec;
  dispatch: (action: any) => void;
  disabled: boolean;
}) {
  const foldouts = useInspectorFoldouts();

  return (
    <InspectorFoldout
      title="Scene — Collisions"
      open={foldouts.isOpen('scene.collisions', false)}
      onToggle={() => foldouts.toggle('scene.collisions', false)}
    >
      <SceneCollisionsBody scene={scene} dispatch={dispatch} disabled={disabled} />
    </InspectorFoldout>
  );
}

export function SceneCollisionsBody({
  scene,
  dispatch,
  disabled,
}: {
  scene: GameSceneSpec;
  dispatch: (action: any) => void;
  disabled: boolean;
}) {
  const rules = scene.collisionRules ?? [];
  const layers = uniqueLayers(scene);

  const renderLayerOptions = () => {
    if (layers.length === 0) {
      return (
        <>
          <option value="player">player</option>
          <option value="world">world</option>
          <option value="enemy">enemy</option>
        </>
      );
    }
    return layers.map((layer) => (
      <option key={layer} value={layer}>{layer}</option>
    ));
  };

  return (
    <>
      <div className="inspector-row">Define overlap or block behavior between collision layers in Play mode.</div>
      <button
        className="button"
        data-testid="add-collision-rule-button"
        type="button"
        disabled={disabled}
        onClick={() => dispatch({ type: 'add-collision-rule' })}
      >
        Add Rule
      </button>

      {rules.length === 0 ? (
        <div className="muted">No collision rules.</div>
      ) : (
        rules.map((rule) => (
          <div key={rule.id} className="inspector-block" data-testid={`collision-rule-row-${rule.id}`}>
            <div className="inspector-row"><strong>{rule.id}</strong></div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>A Layer</span>
                <select
                  aria-label="A Layer"
                  value={rule.a.layer}
                  disabled={disabled}
                  onChange={(e) => dispatch({ type: 'update-collision-rule', id: rule.id, patch: { a: { type: 'layer', layer: e.target.value } } satisfies Partial<CollisionRuleSpec> })}
                >
                  {renderLayerOptions()}
                </select>
              </label>
              <label className="field">
                <span>B Layer</span>
                <select
                  aria-label="B Layer"
                  value={rule.b.layer}
                  disabled={disabled}
                  onChange={(e) => dispatch({ type: 'update-collision-rule', id: rule.id, patch: { b: { type: 'layer', layer: e.target.value } } satisfies Partial<CollisionRuleSpec> })}
                >
                  {renderLayerOptions()}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Interaction</span>
              <select
                aria-label="Interaction"
                value={rule.interaction}
                disabled={disabled}
                onChange={(e) => dispatch({ type: 'update-collision-rule', id: rule.id, patch: { interaction: e.target.value === 'overlap' ? 'overlap' : 'block' } })}
              >
                <option value="block">block</option>
                <option value="overlap">overlap</option>
              </select>
            </label>
            <button
              className="button button-danger"
              type="button"
              disabled={disabled}
              onClick={() => dispatch({ type: 'remove-collision-rule', id: rule.id })}
            >
              Delete Rule
            </button>
          </div>
        ))
      )}
    </>
  );
}
