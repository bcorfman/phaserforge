import { useMemo, useState } from 'react';
import type { TriggerCallSpec, TriggerZoneSpec } from '../model/types';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { ValidatedNumberInput } from './ValidatedNumberInput';
import { parseCallArgsJson } from './callArgsJson';

function callToJson(call: TriggerCallSpec | undefined): string {
  if (!call) return '';
  const args = call.args ?? {};
  return JSON.stringify(args, null, 2);
}

export function TriggerZoneInspector({
  zone,
  dispatch,
  disabled,
}: {
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
        <label className="field">
          <span>Call Id</span>
          <input
            aria-label="onEnter Call Id"
            data-testid="trigger-onenter-callid-input"
            disabled={disabled}
            value={zone.onEnter?.callId ?? ''}
            onChange={(e) => updateCall('onEnter', { callId: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Args (JSON)</span>
          <textarea
            aria-label="onEnter Args (JSON)"
            data-testid="trigger-onenter-args-textarea"
            disabled={disabled}
            value={enterArgsText}
            onChange={(e) => {
              setEnterArgsText(e.target.value);
              setEnterArgsError(null);
            }}
            onBlur={() => {
              const parsed = parseCallArgsJson(enterArgsText);
              if (!parsed.ok) {
                setEnterArgsError(parsed.error);
                return;
              }
              updateCall('onEnter', { args: parsed.value });
              setEnterArgsText(JSON.stringify(parsed.value, null, 2));
              setEnterArgsError(null);
            }}
            rows={4}
          />
        </label>
        {enterArgsError ? <div className="inspector-row error">{enterArgsError}</div> : null}
      </InspectorFoldout>

      <InspectorFoldout
        title="onExit"
        open={foldouts.isOpen('trigger.onExit', false)}
        onToggle={() => foldouts.toggle('trigger.onExit', false)}
      >
        <label className="field">
          <span>Call Id</span>
          <input
            aria-label="onExit Call Id"
            data-testid="trigger-onexit-callid-input"
            disabled={disabled}
            value={zone.onExit?.callId ?? ''}
            onChange={(e) => updateCall('onExit', { callId: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Args (JSON)</span>
          <textarea
            aria-label="onExit Args (JSON)"
            data-testid="trigger-onexit-args-textarea"
            disabled={disabled}
            value={exitArgsText}
            onChange={(e) => {
              setExitArgsText(e.target.value);
              setExitArgsError(null);
            }}
            onBlur={() => {
              const parsed = parseCallArgsJson(exitArgsText);
              if (!parsed.ok) {
                setExitArgsError(parsed.error);
                return;
              }
              updateCall('onExit', { args: parsed.value });
              setExitArgsText(JSON.stringify(parsed.value, null, 2));
              setExitArgsError(null);
            }}
            rows={4}
          />
        </label>
        {exitArgsError ? <div className="inspector-row error">{exitArgsError}</div> : null}
      </InspectorFoldout>

      <InspectorFoldout
        title="onClick"
        open={foldouts.isOpen('trigger.onClick', false)}
        onToggle={() => foldouts.toggle('trigger.onClick', false)}
      >
        <label className="field">
          <span>Call Id</span>
          <input
            aria-label="onClick Call Id"
            data-testid="trigger-onclick-callid-input"
            disabled={disabled}
            value={zone.onClick?.callId ?? ''}
            onChange={(e) => updateCall('onClick', { callId: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Args (JSON)</span>
          <textarea
            aria-label="onClick Args (JSON)"
            data-testid="trigger-onclick-args-textarea"
            disabled={disabled}
            value={clickArgsText}
            onChange={(e) => {
              setClickArgsText(e.target.value);
              setClickArgsError(null);
            }}
            onBlur={() => {
              const parsed = parseCallArgsJson(clickArgsText);
              if (!parsed.ok) {
                setClickArgsError(parsed.error);
                return;
              }
              updateCall('onClick', { args: parsed.value });
              setClickArgsText(JSON.stringify(parsed.value, null, 2));
              setClickArgsError(null);
            }}
            rows={4}
          />
        </label>
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

