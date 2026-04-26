import type { GameSceneSpec, Id } from '../model/types';
import type { Selection } from './EditorStore';

function isSelected(selection: Selection, id: string): boolean {
  return selection.kind === 'trigger' && selection.id === id;
}

export function TriggerZonesPanel({
  scene,
  selection,
  dispatch,
  disabled,
}: {
  scene: GameSceneSpec;
  selection: Selection;
  dispatch: (action: any) => void;
  disabled: boolean;
}) {
  const zones = scene.triggers ?? [];

  return (
    <section className="panel-section" aria-labelledby="scene-graph-triggers">
      <div className="panel-heading-row">
        <h3 className="panel-heading" id="scene-graph-triggers">Trigger Zones</h3>
      </div>

      {zones.length === 0 ? (
        <div className="muted">No trigger zones.</div>
      ) : (
        zones.map((zone) => (
          <div key={zone.id} className="member-row">
            <button
              className={`list-item ${isSelected(selection, zone.id) ? 'active' : ''}`}
              data-testid={`trigger-zone-${zone.id}`}
              type="button"
              onClick={() => dispatch({ type: 'select', selection: { kind: 'trigger', id: zone.id as Id } })}
            >
              {zone.name ?? zone.id}
            </button>
            <button
              aria-label={`Remove trigger zone ${zone.name ?? zone.id}`}
              className="scene-graph-button scene-graph-remove"
              data-testid={`remove-trigger-zone-${zone.id}`}
              type="button"
              disabled={disabled}
              onClick={() => dispatch({ type: 'remove-trigger-zone', id: zone.id })}
            >
              🗑
            </button>
          </div>
        ))
      )}

      <button
        className="button"
        data-testid="add-trigger-zone-button"
        type="button"
        disabled={disabled}
        onClick={() => dispatch({ type: 'add-trigger-zone' })}
      >
        New Zone
      </button>
    </section>
  );
}

