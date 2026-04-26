import { useEffect, useMemo, useState } from 'react';
import type { ProjectSpec, SceneSpec, TriggerCallSpec, TriggerZoneSpec } from '../model/types';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { ValidatedNumberInput } from './ValidatedNumberInput';
import { parseCallArgsJson } from './callArgsJson';

function callToJson(call: TriggerCallSpec | undefined): string {
  if (!call) return '';
  const args = call.args ?? {};
  return JSON.stringify(args, null, 2);
}

type KnownTriggerOpId = 'audio.play_sfx' | 'scene.goto' | 'entity.destroy';
const knownOps: Array<{ id: KnownTriggerOpId; label: string }> = [
  { id: 'audio.play_sfx', label: 'audio.play_sfx' },
  { id: 'scene.goto', label: 'scene.goto' },
  { id: 'entity.destroy', label: 'entity.destroy' },
];

export function TriggerZoneInspector({
  project,
  scene,
  zone,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  scene: SceneSpec;
  zone: TriggerZoneSpec;
  dispatch: (action: any) => void;
  disabled: boolean;
}) {
  const foldouts = useInspectorFoldouts();

  const [enterArgsText, setEnterArgsText] = useState(() => callToJson(zone.onEnter));
  const [enterArgsError, setEnterArgsError] = useState<string | null>(null);
  const [exitArgsText, setExitArgsText] = useState(() => callToJson(zone.onExit));
  const [exitArgsError, setExitArgsError] = useState<string | null>(null);
  const [clickArgsText, setClickArgsText] = useState(() => callToJson(zone.onClick));
  const [clickArgsError, setClickArgsError] = useState<string | null>(null);

  const title = useMemo(() => zone.name ?? zone.id, [zone.id, zone.name]);

  const update = (patch: Partial<TriggerZoneSpec>) => dispatch({ type: 'update-trigger-zone', id: zone.id, patch });

  const updateCall = (key: 'onEnter' | 'onExit' | 'onClick', patch: Partial<TriggerCallSpec> | undefined) => {
    const existing = (zone as any)[key] as TriggerCallSpec | undefined;
    if (!patch) {
      update({ [key]: undefined } as any);
      return;
    }
    const next = { ...(existing ?? { callId: '' }), ...patch };
    if (!next.callId.trim()) {
      update({ [key]: undefined } as any);
      return;
    }
    update({ [key]: next } as any);
  };

  useEffect(() => {
    setEnterArgsText(callToJson(zone.onEnter));
    setEnterArgsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.onEnter?.callId, JSON.stringify(zone.onEnter?.args ?? {})]);

  useEffect(() => {
    setExitArgsText(callToJson(zone.onExit));
    setExitArgsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.onExit?.callId, JSON.stringify(zone.onExit?.args ?? {})]);

  useEffect(() => {
    setClickArgsText(callToJson(zone.onClick));
    setClickArgsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.onClick?.callId, JSON.stringify(zone.onClick?.args ?? {})]);

  const setOp = (key: 'onEnter' | 'onExit' | 'onClick', op: string) => {
    if (!op) {
      updateCall(key, undefined);
      return;
    }
    const current = (zone as any)[key] as TriggerCallSpec | undefined;
    const args = { ...(current?.args ?? {}) } as Record<string, any>;

    if (op === 'audio.play_sfx') {
      const soundIds = Object.keys(project.audio?.sounds ?? {}).sort();
      if (!args.assetId) args.assetId = soundIds[0] ?? '';
      if (args.volume == null) args.volume = 0.35;
    } else if (op === 'scene.goto') {
      const sceneIds = Object.keys(project.scenes ?? {}).sort();
      if (!args.sceneId) args.sceneId = sceneIds[0] ?? '';
      if (!args.transition) args.transition = 'fade';
      if (args.durationMs == null) args.durationMs = 350;
    } else if (op === 'entity.destroy') {
      if (!args.target && !args.entityId) args.target = 'instigator';
    }

    updateCall(key, { callId: op, args });
  };

  const renderCallEditor = (key: 'onEnter' | 'onExit' | 'onClick', call: TriggerCallSpec | undefined, argsText: string, setArgsText: (next: string) => void, setError: (next: string | null) => void) => {
    const opId = call?.callId ?? '';
    const isKnown = knownOps.some((entry) => entry.id === opId);
    const selectValue = !opId ? '' : (isKnown ? opId : '__custom__');

    const args = call?.args ?? {};
    const soundIds = Object.keys(project.audio?.sounds ?? {}).sort();
    const sceneIds = Object.keys(project.scenes ?? {}).sort();
    const entityIds = Object.keys(scene.entities ?? {}).sort();

    const setArgs = (patch: Record<string, any>) => {
      if (!call) return;
      updateCall(key, { args: { ...(call.args ?? {}), ...patch } });
      setError(null);
    };

    return (
      <>
        <label className="field">
          <span>Op</span>
          <select
            aria-label={`${key} Op`}
            data-testid={`trigger-${key.toLowerCase()}-op-select`}
            disabled={disabled}
            value={selectValue}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) {
                setOp(key, '');
                return;
              }
              if (next === '__custom__') {
                updateCall(key, { callId: call?.callId ?? 'custom.op' });
                return;
              }
              setOp(key, next);
            }}
          >
            <option value="">(none)</option>
            {knownOps.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        </label>

        {!isKnown && opId && (
          <label className="field">
            <span>Call Id</span>
            <input
              aria-label={`${key} Call Id`}
              data-testid={`trigger-${key.toLowerCase()}-callid-input`}
              disabled={disabled}
              value={opId}
              onChange={(e) => updateCall(key, { callId: e.target.value })}
            />
          </label>
        )}

        {opId === 'audio.play_sfx' && (
          <>
            <label className="field">
              <span>Sound</span>
              <select
                aria-label={`${key} Sound`}
                data-testid={`trigger-${key.toLowerCase()}-sfx-asset-select`}
                disabled={disabled || soundIds.length === 0}
                value={typeof args.assetId === 'string' ? args.assetId : ''}
                onChange={(e) => setArgs({ assetId: e.target.value })}
              >
                <option value="">{soundIds.length === 0 ? '(no audio assets)' : '(none)'}</option>
                {soundIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Volume</span>
              <ValidatedNumberInput
                aria-label={`${key} Volume`}
                data-testid={`trigger-${key.toLowerCase()}-sfx-volume-input`}
                disabled={disabled}
                min={0}
                max={1}
                step={0.05}
                value={typeof args.volume === 'number' ? args.volume : Number(args.volume ?? 0.35)}
                clamp={(next) => Math.max(0, Math.min(1, next || 0))}
                onCommit={(next) => setArgs({ volume: next })}
              />
            </label>
          </>
        )}

        {opId === 'scene.goto' && (
          <>
            <label className="field">
              <span>Scene</span>
              <select
                aria-label={`${key} Scene`}
                data-testid={`trigger-${key.toLowerCase()}-goto-scene-select`}
                disabled={disabled || sceneIds.length === 0}
                value={typeof args.sceneId === 'string' ? args.sceneId : ''}
                onChange={(e) => setArgs({ sceneId: e.target.value })}
              >
                <option value="">{sceneIds.length === 0 ? '(no scenes)' : '(none)'}</option>
                {sceneIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Transition</span>
                <select
                  aria-label={`${key} Transition`}
                  data-testid={`trigger-${key.toLowerCase()}-goto-transition-select`}
                  disabled={disabled}
                  value={typeof args.transition === 'string' ? args.transition : 'fade'}
                  onChange={(e) => setArgs({ transition: e.target.value === 'none' ? 'none' : 'fade' })}
                >
                  <option value="none">none</option>
                  <option value="fade">fade</option>
                </select>
              </label>
              <label className="field">
                <span>Duration (ms)</span>
                <ValidatedNumberInput
                  aria-label={`${key} Duration (ms)`}
                  data-testid={`trigger-${key.toLowerCase()}-goto-duration-input`}
                  disabled={disabled}
                  min={0}
                  value={typeof args.durationMs === 'number' ? args.durationMs : Number(args.durationMs ?? 350)}
                  clamp={(next) => Math.max(0, next || 0)}
                  onCommit={(next) => setArgs({ durationMs: next })}
                />
              </label>
            </div>
          </>
        )}

        {opId === 'entity.destroy' && (
          <label className="field">
            <span>Target</span>
            <select
              aria-label={`${key} Target`}
              data-testid={`trigger-${key.toLowerCase()}-destroy-target-select`}
              disabled={disabled}
              value={typeof args.entityId === 'string' && args.entityId ? args.entityId : 'instigator'}
              onChange={(e) => {
                const next = e.target.value;
                if (next === 'instigator') {
                  const nextArgs: any = { ...(call?.args ?? {}), target: 'instigator' };
                  delete nextArgs.entityId;
                  updateCall(key, { args: nextArgs });
                  setError(null);
                  return;
                }
                const nextArgs: any = { ...(call?.args ?? {}), entityId: next };
                delete nextArgs.target;
                updateCall(key, { args: nextArgs });
                setError(null);
              }}
            >
              <option value="instigator">instigator</option>
              {entityIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Advanced args (JSON)</span>
          <textarea
            aria-label={`${key} Args (JSON)`}
            data-testid={`trigger-${key.toLowerCase()}-args-textarea`}
            disabled={disabled || !call}
            value={argsText}
            onChange={(e) => {
              setArgsText(e.target.value);
              setError(null);
            }}
            onBlur={() => {
              if (!call) return;
              const parsed = parseCallArgsJson(argsText);
              if (!parsed.ok) {
                setError(parsed.error);
                return;
              }
              updateCall(key, { args: parsed.value });
              setArgsText(JSON.stringify(parsed.value, null, 2));
              setError(null);
            }}
            rows={4}
          />
        </label>
      </>
    );
  };

  return (
    <div className="inspector-block" data-testid="trigger-inspector">
      <div className="inspector-title">{title}</div>
      <InspectorFoldout
        title="Trigger"
        open={foldouts.isOpen('trigger.details', true)}
        onToggle={() => foldouts.toggle('trigger.details', true)}
      >
        <label className="field field-checkbox">
          <span>Enabled</span>
          <input
            aria-label="Enabled"
            data-testid="trigger-enabled-input"
            type="checkbox"
            disabled={disabled}
            checked={zone.enabled !== false}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Name"
            data-testid="trigger-name-input"
            disabled={disabled}
            value={zone.name ?? ''}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <div className="inspector-grid-2">
          <label className="field">
            <span>x</span>
            <ValidatedNumberInput
              aria-label="Trigger X"
              data-testid="trigger-x-input"
              disabled={disabled}
              value={zone.rect.x}
              onCommit={(next) => update({ rect: { ...zone.rect, x: next } })}
            />
          </label>
          <label className="field">
            <span>y</span>
            <ValidatedNumberInput
              aria-label="Trigger Y"
              data-testid="trigger-y-input"
              disabled={disabled}
              value={zone.rect.y}
              onCommit={(next) => update({ rect: { ...zone.rect, y: next } })}
            />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>width</span>
            <ValidatedNumberInput
              aria-label="Trigger Width"
              data-testid="trigger-width-input"
              min={1}
              disabled={disabled}
              value={zone.rect.width}
              clamp={(next) => Math.max(1, next || 1)}
              onCommit={(next) => update({ rect: { ...zone.rect, width: next } })}
            />
          </label>
          <label className="field">
            <span>height</span>
            <ValidatedNumberInput
              aria-label="Trigger Height"
              data-testid="trigger-height-input"
              min={1}
              disabled={disabled}
              value={zone.rect.height}
              clamp={(next) => Math.max(1, next || 1)}
              onCommit={(next) => update({ rect: { ...zone.rect, height: next } })}
            />
          </label>
        </div>
      </InspectorFoldout>

      <InspectorFoldout
        title="onEnter"
        open={foldouts.isOpen('trigger.onEnter', true)}
        onToggle={() => foldouts.toggle('trigger.onEnter', true)}
      >
        {renderCallEditor('onEnter', zone.onEnter, enterArgsText, setEnterArgsText, setEnterArgsError)}
        {enterArgsError ? <div className="inspector-row error">{enterArgsError}</div> : null}
      </InspectorFoldout>

      <InspectorFoldout
        title="onExit"
        open={foldouts.isOpen('trigger.onExit', false)}
        onToggle={() => foldouts.toggle('trigger.onExit', false)}
      >
        {renderCallEditor('onExit', zone.onExit, exitArgsText, setExitArgsText, setExitArgsError)}
        {exitArgsError ? <div className="inspector-row error">{exitArgsError}</div> : null}
      </InspectorFoldout>

      <InspectorFoldout
        title="onClick"
        open={foldouts.isOpen('trigger.onClick', false)}
        onToggle={() => foldouts.toggle('trigger.onClick', false)}
      >
        {renderCallEditor('onClick', zone.onClick, clickArgsText, setClickArgsText, setClickArgsError)}
        {clickArgsError ? <div className="inspector-row error">{clickArgsError}</div> : null}
      </InspectorFoldout>

      <button
        className="button button-danger"
        data-testid="trigger-delete-button"
        type="button"
        disabled={disabled}
        onClick={() => dispatch({ type: 'remove-trigger-zone', id: zone.id })}
      >
        Delete Zone
      </button>
    </div>
  );
}
