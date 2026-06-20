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
  const [mapMenu, setMapMenu] = useState<{ mapId: string; x: number; y: number } | null>(null);
  const prevMapIds = useRef<string[]>(mapIds);
  const mapMenuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = prevMapIds.current;
    prevMapIds.current = mapIds;
    if (!selectedMapId && mapIds[0]) setSelectedMapId(mapIds[0]);
    if (selectedMapId && !maps[selectedMapId]) setSelectedMapId(mapIds[0] ?? '');
    if (mapIds.length > prev.length) {
      const created = mapIds.find((id) => !prev.includes(id));
      if (created) setSelectedMapId(created);
    }
  }, [mapIds, maps, selectedMapId]);

  useEffect(() => {
    if (!mapMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = mapMenuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setMapMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMapMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mapMenu]);

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

  const removeSpecificMap = (mapId: string) => {
    dispatch({ type: 'remove-input-map', mapId } as any);
    if (selectedMapId === mapId) setSelectedMapId('');
    setMapMenu(null);
  };

  const duplicateSpecificMap = (mapId: string) => {
    const nextId = allocUniqueId(maps, `${mapId}_copy`);
    dispatch({ type: 'duplicate-input-map', sourceMapId: mapId, nextMapId: nextId } as any);
    setMapMenu(null);
  };

  const setProjectDefaultMap = (mapId?: string) => {
    dispatch({ type: 'set-project-default-input-map', mapId } as any);
    setMapMenu(null);
  };

  const startCapture = (actionId: string) => {
    if (!selectedMapId) return;
    if (!actionId.trim()) return;
    setCapture({ mapId: selectedMapId, actionId: actionId.trim() });
  };

  return (
    <section className="panel-section" aria-labelledby="input-maps" data-testid="input-maps-panel">
      <div className="panel-heading-row">
        <h3 className="panel-heading" id="input-maps">Input Maps</h3>
        <button className="button button-compact" data-testid="create-input-map-button" type="button" disabled={disabled} onClick={createMap}>
          + Add
        </button>
      </div>

      {mapIds.length === 0 && (
        <div className="muted" style={{ padding: '6px 0' }}>
          No input maps yet.
        </div>
      )}

      <div className="member-list">
        {mapIds.map((id) => (
          <div key={id} className="member-row">
            <button
              className={`list-item ${id === selectedMapId ? 'active' : ''}`}
              data-testid={`input-map-${id}`}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedMapId(id)}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{id}</span>
              <span className="list-item-meta">
                {project.defaultInputMapId === id ? 'Default' : `${Object.keys(maps[id]?.actions ?? {}).length} actions`}
              </span>
            </button>
            <button
              aria-label={`More options for input map ${id}`}
              className="scene-graph-button"
              data-testid={`input-map-menu-${id}`}
              type="button"
              disabled={disabled}
              onClick={(event) => {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                setMapMenu({
                  mapId: id,
                  x: Math.min(rect.left, window.innerWidth - 220),
                  y: rect.bottom + 6,
                });
              }}
            >
              ⋯
            </button>
          </div>
        ))}
      </div>

      {selectedMap && (
        <div style={{ marginTop: 10 }}>
          <div className="panel-heading-row" style={{ marginBottom: 6 }}>
            <div className="muted" style={{ fontWeight: 700 }}>
              Editing: {selectedMapId}
            </div>
            {project.defaultInputMapId === selectedMapId ? (
              <button
                className="button button-compact"
                data-testid="clear-project-default-input-map-button"
                type="button"
                disabled={disabled}
                onClick={() => setProjectDefaultMap(undefined)}
              >
                Clear Default
              </button>
            ) : (
              <button
                className="button button-compact"
                data-testid="set-project-default-input-map-button"
                type="button"
                disabled={disabled}
                onClick={() => setProjectDefaultMap(selectedMapId)}
              >
                Set as Default
              </button>
            )}
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

      {mapMenu ? (
        <div
          ref={mapMenuRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: mapMenu.x, top: mapMenu.y, zIndex: 50, minWidth: 200 }}
          data-testid="input-map-overflow-menu"
          role="menu"
        >
          <div className="scene-graph-menu-hint">{mapMenu.mapId}</div>
          <button
            type="button"
            className="scene-graph-menu-item"
            data-testid={`duplicate-input-map-button-${mapMenu.mapId}`}
            onClick={() => duplicateSpecificMap(mapMenu.mapId)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="scene-graph-menu-item"
            data-testid={`set-default-input-map-button-${mapMenu.mapId}`}
            onClick={() => setProjectDefaultMap(mapMenu.mapId)}
          >
            Set as Project Default
          </button>
          {project.defaultInputMapId === mapMenu.mapId ? (
            <button
              type="button"
              className="scene-graph-menu-item"
              data-testid={`clear-default-input-map-button-${mapMenu.mapId}`}
              onClick={() => setProjectDefaultMap(undefined)}
            >
              Clear Project Default
            </button>
          ) : null}
          <div className="scene-graph-menu-divider" />
          <button
            type="button"
            className="scene-graph-menu-item scene-graph-menu-danger"
            data-testid={`remove-input-map-button-${mapMenu.mapId}`}
            onClick={() => removeSpecificMap(mapMenu.mapId)}
          >
            Remove
          </button>
        </div>
      ) : null}
    </section>
  );
}
