import { useEffect, useMemo, useRef, useState } from 'react';

import type { EntitySpec, SceneSpec, SpriteAssetSpec } from '../model/types';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { getCommonResolvedEntityValue, type CommonValue } from './commonEntityValues';

function coerceFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function CommonNumberInput({
  valueState,
  disabled,
  placeholder,
  min,
  max,
  step,
  clamp,
  onCommit,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: {
  valueState: CommonValue<number>;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  clamp?: (value: number) => number;
  onCommit: (next: number) => void;
  'data-testid'?: string;
  'aria-label'?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (editing) return;
    setDraft(valueState.kind === 'same' ? String(valueState.value) : '');
  }, [editing, valueState]);

  const commit = () => {
    setEditing(false);
    const parsed = coerceFiniteNumber(draft);
    if (parsed === null) {
      setDraft(valueState.kind === 'same' ? String(valueState.value) : '');
      return;
    }
    const next = clamp ? clamp(parsed) : parsed;
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className="text-input"
      type="text"
      inputMode="decimal"
      disabled={disabled}
      min={min as any}
      max={max as any}
      step={step as any}
      value={draft}
      placeholder={valueState.kind === 'mixed' ? (placeholder ?? 'Mixed') : undefined}
      onChange={(e) => {
        setEditing(true);
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(valueState.kind === 'same' ? String(valueState.value) : '');
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function TriStateCheckbox({
  valueState,
  disabled,
  onCommit,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: {
  valueState: CommonValue<boolean>;
  disabled?: boolean;
  onCommit: (next: boolean) => void;
  'data-testid'?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const checked = valueState.kind === 'same' ? valueState.value : false;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = valueState.kind === 'mixed';
  }, [valueState.kind]);

  return (
    <input
      ref={ref}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={(e) => onCommit(e.target.checked)}
    />
  );
}

function DisabledHint() {
  return <div className="muted" style={{ marginTop: 8 }}>Some fields are disabled for multi-select in v1.</div>;
}

export function MultiEntityInspector({
  entityIds,
  scene,
  dispatch,
  disabled,
  assetOptions,
}: {
  entityIds: string[];
  scene: SceneSpec;
  dispatch: (action: any) => void;
  disabled: boolean;
  assetOptions: Array<{ key: string; label: string; asset?: SpriteAssetSpec }>;
}) {
  const entities: EntitySpec[] = useMemo(
    () => entityIds.map((id) => scene.entities[id]).filter(Boolean) as EntitySpec[],
    [entityIds, scene.entities]
  );
  const foldouts = useInspectorFoldouts();

  const patchAll = (patch: Partial<EntitySpec>) =>
    dispatch({ type: 'patch-entities', entityIds, patch });

  const x = getCommonResolvedEntityValue(entities, 'x');
  const y = getCommonResolvedEntityValue(entities, 'y');
  const width = getCommonResolvedEntityValue(entities, 'width');
  const height = getCommonResolvedEntityValue(entities, 'height');
  const scaleX = getCommonResolvedEntityValue(entities, 'scaleX');
  const scaleY = getCommonResolvedEntityValue(entities, 'scaleY');
  const rotationDeg = getCommonResolvedEntityValue(entities, 'rotationDeg');
  const originX = getCommonResolvedEntityValue(entities, 'originX');
  const originY = getCommonResolvedEntityValue(entities, 'originY');
  const flipX = getCommonResolvedEntityValue(entities, 'flipX');
  const flipY = getCommonResolvedEntityValue(entities, 'flipY');
  const alpha = getCommonResolvedEntityValue(entities, 'alpha');
  const visible = getCommonResolvedEntityValue(entities, 'visible');
  const depth = getCommonResolvedEntityValue(entities, 'depth');

  const assetKey = useMemo(() => {
    const keys = entities.map((e) => {
      const asset = (e as any).asset as SpriteAssetSpec | undefined;
      if (!asset) return '__none__';
      if (asset.source.kind === 'asset') return `asset:${asset.source.assetId}`;
      if (asset.source.kind === 'path') return `path:${asset.source.path}`;
      return `embedded:${asset.source.originalName ?? ''}:${asset.source.mimeType ?? ''}:${asset.source.dataUrl.length}`;
    });
    const first = keys[0] ?? '__none__';
    return keys.every((k) => k === first) ? first : '__mixed__';
  }, [entities]);

  return (
    <div className="inspector-block" data-testid="multi-entity-inspector">
      <div className="inspector-title">Multi-select</div>
      <div className="inspector-row">{entityIds.length} sprites selected</div>

      <InspectorFoldout
        title="Transform"
        open={foldouts.isOpen('entity.transform', true)}
        onToggle={() => foldouts.toggle('entity.transform', true)}
      >
        <div className="inspector-grid-2">
          <label className="field inspector-field-disabled">
            <span>X</span>
            <CommonNumberInput
              aria-label="Entity X"
              data-testid="entity-x-input"
              valueState={x as any}
              disabled
              onCommit={() => {}}
            />
          </label>
          <label className="field inspector-field-disabled">
            <span>Y</span>
            <CommonNumberInput
              aria-label="Entity Y"
              data-testid="entity-y-input"
              valueState={y as any}
              disabled
              onCommit={() => {}}
            />
          </label>
        </div>

        <div className="inspector-block inspector-field-disabled" style={{ padding: 0, marginTop: 10, border: 'none', boxShadow: 'none', background: 'transparent' }}>
          <div className="inspector-row" style={{ marginBottom: 6, fontWeight: 700 }}>Sprite Size</div>
          <div className="inspector-grid-2">
            <button className="button button-compact" type="button" disabled data-testid="sprite-size-tab-percent">
              Percent
            </button>
            <button className="button button-compact" type="button" disabled data-testid="sprite-size-tab-pixels">
              Pixels
            </button>
          </div>
          <div className="inspector-grid-3" style={{ marginTop: 8 }}>
            <label className="field">
              <span>Scale X (%)</span>
              <input className="text-input" type="text" readOnly value="" placeholder="—" data-testid="sprite-size-scale-x-percent" />
            </label>
            <button type="button" className="sprite-size-aspect" disabled data-testid="sprite-size-aspect-percent" aria-pressed={true} title="Maintain Aspect Ratio">
              ↔
            </button>
            <label className="field">
              <span>Scale Y (%)</span>
              <input className="text-input" type="text" readOnly value="" placeholder="—" data-testid="sprite-size-scale-y-percent" />
            </label>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>Disabled for multi-select (v1)</div>
        </div>

        <div className="inspector-grid-2" style={{ marginTop: 10 }}>
          <label className="field inspector-field-disabled">
            <span>Width</span>
            <CommonNumberInput
              aria-label="Entity Width"
              data-testid="entity-width-input"
              valueState={width as any}
              disabled
              onCommit={() => {}}
            />
          </label>
          <label className="field inspector-field-disabled">
            <span>Height</span>
            <CommonNumberInput
              aria-label="Entity Height"
              data-testid="entity-height-input"
              valueState={height as any}
              disabled
              onCommit={() => {}}
            />
          </label>
        </div>

        <div className="inspector-grid-2">
          <label className="field">
            <span>Scale X</span>
            <CommonNumberInput
              aria-label="Scale X"
              data-testid="entity-scale-x-input"
              valueState={scaleX as any}
              disabled={disabled}
              clamp={(next) => Math.max(0.01, next || 0.01)}
              onCommit={(next) => patchAll({ scaleX: next })}
            />
          </label>
          <label className="field">
            <span>Scale Y</span>
            <CommonNumberInput
              aria-label="Scale Y"
              data-testid="entity-scale-y-input"
              valueState={scaleY as any}
              disabled={disabled}
              clamp={(next) => Math.max(0.01, next || 0.01)}
              onCommit={(next) => patchAll({ scaleY: next })}
            />
          </label>
        </div>

        <label className="field">
          <span>Rotation</span>
          <CommonNumberInput
            aria-label="Rotation"
            data-testid="entity-rotation-input"
            valueState={rotationDeg as any}
            disabled={disabled}
            clamp={(next) => Math.max(0, Math.min(359, next || 0))}
            onCommit={(next) => patchAll({ rotationDeg: next })}
          />
        </label>

        <div className="inspector-grid-2">
          <label className="field">
            <span>Origin X</span>
            <CommonNumberInput
              aria-label="Origin X"
              data-testid="entity-origin-x-input"
              valueState={originX as any}
              disabled={disabled}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => patchAll({ originX: next })}
            />
          </label>
          <label className="field">
            <span>Origin Y</span>
            <CommonNumberInput
              aria-label="Origin Y"
              data-testid="entity-origin-y-input"
              valueState={originY as any}
              disabled={disabled}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => patchAll({ originY: next })}
            />
          </label>
        </div>

        <div className="inspector-grid-2">
          <label className="field field-checkbox">
            <span>Flip X</span>
            <TriStateCheckbox
              aria-label="Flip X"
              data-testid="entity-flip-x-input"
              valueState={flipX as any}
              disabled={disabled}
              onCommit={(next) => patchAll({ flipX: next })}
            />
          </label>
          <label className="field field-checkbox">
            <span>Flip Y</span>
            <TriStateCheckbox
              aria-label="Flip Y"
              data-testid="entity-flip-y-input"
              valueState={flipY as any}
              disabled={disabled}
              onCommit={(next) => patchAll({ flipY: next })}
            />
          </label>
        </div>

        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Text"
        open={foldouts.isOpen('entity.text', true)}
        onToggle={() => foldouts.toggle('entity.text', true)}
      >
        <div className="muted inspector-field-disabled">Disabled for multi-select in v1.</div>
        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Hitbox (Bounds)"
        open={foldouts.isOpen('entity.hitbox', false)}
        onToggle={() => foldouts.toggle('entity.hitbox', false)}
      >
        <div className="muted inspector-field-disabled">Disabled for multi-select in v1.</div>
        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Physics"
        open={foldouts.isOpen('entity.physics', false)}
        onToggle={() => foldouts.toggle('entity.physics', false)}
      >
        <div className="muted inspector-field-disabled">Disabled for multi-select in v1.</div>
        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Visual"
        open={foldouts.isOpen('entity.visual', true)}
        onToggle={() => foldouts.toggle('entity.visual', true)}
      >
        <div className="inspector-grid-2">
          <label className="field">
            <span>Alpha</span>
            <CommonNumberInput
              aria-label="Alpha"
              data-testid="entity-alpha-input"
              valueState={alpha as any}
              disabled={disabled}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => patchAll({ alpha: next })}
            />
          </label>
          <label className="field field-checkbox">
            <span>Visible</span>
            <TriStateCheckbox
              aria-label="Visible"
              data-testid="entity-visible-input"
              valueState={visible as any}
              disabled={disabled}
              onCommit={(next) => patchAll({ visible: next })}
            />
          </label>
        </div>

        <label className="field">
          <span>Depth</span>
          <CommonNumberInput
            aria-label="Depth"
            data-testid="entity-depth-input"
            valueState={depth as any}
            disabled={disabled}
            onCommit={(next) => patchAll({ depth: next })}
          />
        </label>

        <label className="field inspector-field-disabled">
          <span>Asset</span>
          <select aria-label="Asset" data-testid="entity-asset-select" value={assetKey} disabled>
            <option value="__mixed__">(mixed)</option>
            <option value="__none__">None (placeholder)</option>
            {assetOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>

        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Asset Details"
        open={foldouts.isOpen('entity.asset', false)}
        onToggle={() => foldouts.toggle('entity.asset', false)}
      >
        <div className="muted inspector-field-disabled">Disabled for multi-select in v1.</div>
        <DisabledHint />
      </InspectorFoldout>

      <InspectorFoldout
        title="Actions/Events"
        open={foldouts.isOpen('entity.actions', false)}
        onToggle={() => foldouts.toggle('entity.actions', false)}
      >
        <div className="muted inspector-field-disabled">Disabled for multi-select in v1.</div>
        <DisabledHint />
      </InspectorFoldout>
    </div>
  );
}
