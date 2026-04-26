import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputBindingSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';

function summarizeBinding(binding: InputBindingSpec): string {
  switch (binding.device) {
    case 'keyboard': {
      const key = binding.key.startsWith('Key') && binding.key.length === 4 ? binding.key.slice(3) : binding.key;
      return `keyboard.${key}`;
    }
    case 'mouse':
      return `mouse.${binding.button}`;
    case 'gamepad':
      return `gamepad.${binding.control}`;
    case 'pointer':
      return `pointer.${binding.event}`;
    default:
      return 'unknown';
  }
}

function allocUniqueId(existing: Record<string, unknown>, base: string): string {
  const sanitizedBase = base.trim().length > 0 ? base.trim() : 'input-map';
  if (!existing[sanitizedBase]) return sanitizedBase;
  let counter = 2;
  while (existing[`${sanitizedBase}-${counter}`]) counter += 1;
  return `${sanitizedBase}-${counter}`;
}

export function InputMapsPanel({
  project,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const maps = project.inputMaps ?? {};
  const mapIds = useMemo(() => Object.keys(maps).sort(), [maps]);

  const [selectedMapId, setSelectedMapId] = useState<string>(() => mapIds[0] ?? '');
  const [newActionName, setNewActionName] = useState('');
  const [capture, setCapture] = useState<{ mapId: string; actionId: string } | null>(null);
  const prevMapIds = useRef<string[]>(mapIds);

  useEffect(() => {
    const prev = prevMapIds.current;
    prevMapIds.current = mapIds;
    if (!selectedMapId && mapIds[0]) setSelectedMapId(mapIds[0]);
    if (mapIds.length > prev.length) {
      const created = mapIds.find((id) => !prev.includes(id));
      if (created) setSelectedMapId(created);
    }
  }, [mapIds, selectedMapId]);

  useEffect(() => {
    if (!capture) return;
    if (disabled) {
      setCapture(null);
      return;
    }
    const ignoredButtons = new Set<string>();
    const bootstrapIgnoredButtons = () => {
      const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? Array.from(navigator.getGamepads()) : [];
      for (let padIndex = 0; padIndex < pads.length; padIndex += 1) {
        const pad = pads[padIndex];
        if (!pad) continue;
        for (let buttonIndex = 0; buttonIndex < pad.buttons.length; buttonIndex += 1) {
          const b = pad.buttons[buttonIndex];
          const pressed = Boolean(b && (b.pressed || b.value > 0.5));
          if (pressed) ignoredButtons.add(`${padIndex}:${buttonIndex}`);
        }
      }
    };
    bootstrapIgnoredButtons();

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      dispatch({
        type: 'add-input-binding',
        mapId: capture.mapId,
        actionId: capture.actionId,
        binding: { device: 'keyboard', key: event.code || event.key || '', event: 'held' },
      } as any);
      setCapture(null);
    };

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      const button = event.button === 1 ? 'middle' : event.button === 2 ? 'right' : 'left';
      dispatch({
        type: 'add-input-binding',
        mapId: capture.mapId,
        actionId: capture.actionId,
        binding: { device: 'mouse', button, event: 'held' },
      } as any);
      setCapture(null);
    };

    let raf = 0;
    const pollGamepad = () => {
      if (!capture) return;
      const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? Array.from(navigator.getGamepads()) : [];
      for (let padIndex = 0; padIndex < pads.length; padIndex += 1) {
        const pad = pads[padIndex];
        if (!pad) continue;
        for (let buttonIndex = 0; buttonIndex < pad.buttons.length; buttonIndex += 1) {
          const b = pad.buttons[buttonIndex];
          const pressed = Boolean(b && (b.pressed || b.value > 0.5));
          if (!pressed) continue;
          const key = `${padIndex}:${buttonIndex}`;
          if (ignoredButtons.has(key)) continue;
          dispatch({
            type: 'add-input-binding',
            mapId: capture.mapId,
            actionId: capture.actionId,
            binding: { device: 'gamepad', control: `button.${buttonIndex}`, event: 'down' },
          } as any);
          setCapture(null);
          return;
        }
      }
      raf = window.requestAnimationFrame(pollGamepad);
    };
    raf = window.requestAnimationFrame(pollGamepad);

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
      window.removeEventListener('mousedown', handleMouseDown, { capture: true } as any);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [capture, disabled, dispatch]);

  const selectedMap = selectedMapId ? maps[selectedMapId] : undefined;
  const actionIds = useMemo(() => Object.keys(selectedMap?.actions ?? {}).sort(), [selectedMap?.actions]);

  const createMap = () => dispatch({ type: 'create-input-map' } as any);

  const duplicateMap = () => {
    if (!selectedMapId) return;
    const nextId = allocUniqueId(maps, `${selectedMapId}_copy`);
    dispatch({ type: 'duplicate-input-map', sourceMapId: selectedMapId, nextMapId: nextId } as any);
  };

  const removeMap = () => {
    if (!selectedMapId) return;
    dispatch({ type: 'remove-input-map', mapId: selectedMapId } as any);
    setSelectedMapId('');
  };

  const startCapture = (actionId: string) => {
    if (!selectedMapId) return;
    if (!actionId.trim()) return;
    setCapture({ mapId: selectedMapId, actionId: actionId.trim() });
  };

  return (
    <section className="panel-section" aria-labelledby="input-maps">
      <div className="panel-heading-row">
        <h3 className="panel-heading" id="input-maps">Input Maps</h3>
      </div>

      <label className="field">
        <span>Project default</span>
        <select
          aria-label="Project default input map"
          data-testid="project-default-input-map-select"
          value={project.defaultInputMapId ?? ''}
          disabled={disabled || mapIds.length === 0}
          onChange={(e) => dispatch({ type: 'set-project-default-input-map', mapId: e.target.value || undefined } as any)}
        >
          <option value="">(none)</option>
          {mapIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>

      {mapIds.length === 0 && (
        <div className="muted" style={{ padding: '6px 0' }}>
          No input maps yet.
        </div>
      )}

      <div className="member-list">
        {mapIds.map((id) => (
          <button
            key={id}
            className={`list-item ${id === selectedMapId ? 'active' : ''}`}
            data-testid={`input-map-${id}`}
            type="button"
            disabled={disabled}
            onClick={() => setSelectedMapId(id)}
          >
            {id}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="button" data-testid="create-input-map-button" type="button" disabled={disabled} onClick={createMap}>
          + New Map
        </button>
        <button className="button" data-testid="duplicate-input-map-button" type="button" disabled={disabled || !selectedMapId} onClick={duplicateMap}>
          Duplicate
        </button>
        <button className="button button-danger" data-testid="remove-input-map-button" type="button" disabled={disabled || !selectedMapId} onClick={removeMap}>
          Remove
        </button>
      </div>

      {selectedMap && (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>
            Editing: {selectedMapId}
          </div>

          {actionIds.length === 0 && (
            <div className="muted" style={{ padding: '6px 0' }}>
              No actions yet.
            </div>
          )}

          {actionIds.map((actionId) => {
            const bindings = selectedMap.actions[actionId] ?? [];
            return (
              <div key={actionId} className="member-row" style={{ alignItems: 'center' }}>
                <div className="list-item" style={{ flex: 1, textAlign: 'left', opacity: disabled ? 0.7 : 1 }}>
                  <div style={{ fontWeight: 700 }}>{actionId}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {bindings.length === 0 ? '(no bindings)' : bindings.map(summarizeBinding).join(', ')}
                  </div>
                </div>
                <button
                  className="scene-graph-button"
                  type="button"
                  data-testid={`bind-input-action-${actionId}`}
                  disabled={disabled}
                  onClick={() => startCapture(actionId)}
                  aria-label={`Bind ${actionId}`}
                >
                  ⌨
                </button>
              </div>
            );
          })}

          <div className="field" style={{ marginTop: 8 }}>
            <span>New action</span>
            <input
              aria-label="New input action name"
              data-testid="new-input-action-name"
              type="text"
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              placeholder="Jump"
              disabled={disabled}
            />
            <button
              className="button"
              data-testid="bind-new-input-action-button"
              type="button"
              disabled={disabled || !newActionName.trim() || !selectedMapId}
              onClick={() => startCapture(newActionName)}
            >
              Bind…
            </button>
          </div>

          {capture && (
            <div className="inspector-row" data-testid="input-binding-capture" style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 800 }}>Binding capture</div>
              <div className="muted">Press a key, click a mouse button, or press a gamepad button to bind <span style={{ fontWeight: 700 }}>{capture.actionId}</span>.</div>
              <button className="button" type="button" onClick={() => setCapture(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
