import { useEffect, useMemo, type CSSProperties, type PointerEvent } from 'react';
import type { EditorRegistryConfig, Id, ProjectSpec, SceneSpec } from '../model/types';
import { ValidatedNumberInput } from './ValidatedNumberInput';
import { getTemplateDisplayLabel, type FormationDraftSpec, type FormationTemplateSource } from './formationDraft';
import { makeSeed } from './deterministicRandom';

function encodeTemplateValue(template: FormationTemplateSource): string {
  if (template.kind === 'entity') return `entity:${template.entityId}`;
  return `asset:${template.assetKind}:${template.assetId}`;
}

function decodeTemplateValue(value: string): FormationTemplateSource | null {
  const parts = value.split(':');
  if (parts[0] === 'entity' && parts[1]) return { kind: 'entity', entityId: parts[1] as Id };
  if (parts[0] === 'asset' && (parts[1] === 'image' || parts[1] === 'spritesheet') && parts[2]) {
    return { kind: 'asset', assetKind: parts[1], assetId: parts[2] as Id };
  }
  return null;
}

export function CreateFormationDraftPanel({
  project,
  scene,
  registry,
  draft,
  dispatch,
  popupClassName,
  popupStyle,
  onPopupPointerDown,
}: {
  project: ProjectSpec;
  scene: SceneSpec;
  registry: EditorRegistryConfig;
  draft: FormationDraftSpec;
  dispatch: (action: any) => void;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  onPopupPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  const arrangeEntries = useMemo(() => registry.arrange.filter((entry) => entry.implemented), [registry.arrange]);
  const presetOptions = arrangeEntries.length > 0 ? arrangeEntries : [{ type: 'grid', displayName: 'Grid', implemented: true } as any];

  const templateOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const entityValues = Object.values(scene.entities)
      .slice()
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
      .map((entity) => ({ value: encodeTemplateValue({ kind: 'entity', entityId: entity.id }), label: `Sprite: ${entity.name ?? entity.id}` }));

    const imageValues = Object.values(project.assets.images ?? {})
      .slice()
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
      .map((asset) => ({ value: encodeTemplateValue({ kind: 'asset', assetKind: 'image', assetId: asset.id }), label: `Asset: ${asset.name ?? asset.id}` }));

    const sheetValues = Object.values(project.assets.spriteSheets ?? {})
      .slice()
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
      .map((asset) => ({ value: encodeTemplateValue({ kind: 'asset', assetKind: 'spritesheet', assetId: asset.id }), label: `Asset: ${asset.name ?? asset.id}` }));

    options.push(...imageValues, ...sheetValues, ...entityValues);
    return options;
  }, [project.assets.images, project.assets.spriteSheets, scene.entities]);

  const currentTemplateValue = encodeTemplateValue(draft.template);
  const currentTemplateLabel = getTemplateDisplayLabel(scene, project, draft.template);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch({ type: 'cancel-formation-draft' });
      } else if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) {
        event.preventDefault();
        dispatch({ type: 'commit-formation-draft' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  const updateParams = (patch: Record<string, number | string | boolean>) => {
    dispatch({ type: 'update-formation-draft', patch: { params: { ...draft.params, ...patch } } });
  };

  const arrangeKind = draft.arrangeKind;
  const isGrid = arrangeKind === 'grid';
  const isScatter = arrangeKind === 'scatter';
  const rows = Math.max(1, Math.floor(Number((draft.params as any).rows ?? 3) || 3));
  const cols = Math.max(1, Math.floor(Number((draft.params as any).cols ?? 4) || 4));
  const count = isGrid ? rows * cols : Math.max(1, Math.floor(Number(draft.memberCount ?? 12) || 12));
  const numberParam = (key: string, fallback: number) => {
    const parsed = Number((draft.params as any)[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <div
      className={`canvas-context-menu${popupClassName ? ` ${popupClassName}` : ''}`}
      data-testid="create-formation-draft-panel"
      role="dialog"
      aria-label="Create formation draft"
      style={popupStyle}
      onPointerDown={onPopupPointerDown}
    >
      <div className="inspector-block" style={{ width: 360 }}>
        <div className="inspector-title">Create Formation (Draft)</div>
        <div className="inspector-row">Edits update the real canvas immediately</div>

        <label className="field">
          <span>Template source</span>
          <select
            aria-label="Template source"
            data-testid="formation-draft-template-select"
            value={currentTemplateValue}
            onChange={(event) => {
              const decoded = decodeTemplateValue(event.target.value);
              if (!decoded) return;
              dispatch({ type: 'update-formation-draft', patch: { template: decoded } });
            }}
            disabled={templateOptions.length === 0}
          >
            {templateOptions.length === 0 ? (
              <option value={currentTemplateValue}>{currentTemplateLabel}</option>
            ) : (
              templateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            )}
          </select>
        </label>

        <label className="field">
          <span>Formation name</span>
          <input
            aria-label="Formation name"
            data-testid="formation-draft-name-input"
            type="text"
            value={draft.name}
            onChange={(event) => dispatch({ type: 'update-formation-draft', patch: { name: event.target.value } })}
            placeholder={draft.name}
          />
        </label>

        <div className="inspector-grid-2">
          <label className="field">
            <span>Preset</span>
            <select
              aria-label="Arrange preset"
              data-testid="formation-draft-preset-select"
              value={arrangeKind}
              onChange={(event) => dispatch({ type: 'update-formation-draft', patch: { arrangeKind: event.target.value } })}
            >
              {presetOptions.map((entry: any) => (
                <option key={entry.type} value={entry.type}>{entry.displayName ?? entry.type}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Count</span>
            <ValidatedNumberInput
              aria-label="Count"
              data-testid="formation-draft-count-input"
              value={count}
              onCommit={(next) => {
                if (isGrid) return;
                dispatch({ type: 'update-formation-draft', patch: { memberCount: Math.max(1, Math.min(200, Math.floor(next || 1))) } });
              }}
              disabled={isGrid}
            />
          </label>
        </div>

        <div className="inspector-row" style={{ marginTop: 6 }}>Parameters</div>

        {isGrid ? (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="field">
                <span>Rows</span>
                <ValidatedNumberInput
                  aria-label="Rows"
                  data-testid="formation-draft-grid-rows"
                  value={rows}
                  onCommit={(next) => updateParams({ rows: Math.max(1, Math.min(50, Math.floor(next || 1))) })}
                />
              </label>
              <label className="field">
                <span>Cols</span>
                <ValidatedNumberInput
                  aria-label="Cols"
                  data-testid="formation-draft-grid-cols"
                  value={cols}
                  onCommit={(next) => updateParams({ cols: Math.max(1, Math.min(50, Math.floor(next || 1))) })}
                />
              </label>
              <label className="field">
                <span>Spacing</span>
                <ValidatedNumberInput
                  aria-label="Spacing"
                  data-testid="formation-draft-grid-spacing"
                  value={Math.round(Number((draft.params as any).spacing ?? 24) || 24)}
                  onCommit={(next) => updateParams({ spacing: Math.max(0, Math.min(500, Math.round(next || 0))) })}
                />
              </label>
            </div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Center X</span>
                <ValidatedNumberInput
                  aria-label="Center X"
                  data-testid="formation-draft-center-x"
                  value={Math.round(Number((draft.params as any).centerX ?? 0) || 0)}
                  onCommit={(next) => updateParams({ centerX: Math.round(next || 0) })}
                />
              </label>
              <label className="field">
                <span>Center Y</span>
                <ValidatedNumberInput
                  aria-label="Center Y"
                  data-testid="formation-draft-center-y"
                  value={Math.round(Number((draft.params as any).centerY ?? 0) || 0)}
                  onCommit={(next) => updateParams({ centerY: Math.round(next || 0) })}
                />
              </label>
            </div>
          </>
        ) : isScatter ? (
          <>
            <div className="inspector-grid-2">
              <label className="field">
                <span>X Min</span>
                <ValidatedNumberInput
                  aria-label="X Min"
                  data-testid="formation-draft-scatter-min-x"
                  value={numberParam('minX', 0)}
                  onCommit={(next) => updateParams({ minX: Math.round(next || 0) })}
                />
              </label>
              <label className="field">
                <span>X Max</span>
                <ValidatedNumberInput
                  aria-label="X Max"
                  data-testid="formation-draft-scatter-max-x"
                  value={numberParam('maxX', scene.world?.width ?? 1024)}
                  onCommit={(next) => updateParams({ maxX: Math.round(next || 0) })}
                />
              </label>
            </div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Y Min</span>
                <ValidatedNumberInput
                  aria-label="Y Min"
                  data-testid="formation-draft-scatter-min-y"
                  value={numberParam('minY', 0)}
                  onCommit={(next) => updateParams({ minY: Math.round(next || 0) })}
                />
              </label>
              <label className="field">
                <span>Y Max</span>
                <ValidatedNumberInput
                  aria-label="Y Max"
                  data-testid="formation-draft-scatter-max-y"
                  value={numberParam('maxY', scene.world?.height ?? 768)}
                  onCommit={(next) => updateParams({ maxY: Math.round(next || 0) })}
                />
              </label>
            </div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Seed</span>
                <input
                  aria-label="Seed"
                  data-testid="formation-draft-scatter-seed"
                  type="text"
                  value={String((draft.params as any).seed ?? '')}
                  onChange={(event) => updateParams({ seed: event.target.value })}
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <button
                  className="button"
                  type="button"
                  data-testid="formation-draft-scatter-reroll"
                  onClick={() => updateParams({ seed: makeSeed('scatter') })}
                >
                  Reroll
                </button>
              </label>
            </div>
            <details data-testid="formation-draft-random-tint">
              <summary>Random tint</summary>
              <label className="field field-inline">
                <input
                  aria-label="Random tint"
                  data-testid="formation-draft-random-tint-enabled"
                  type="checkbox"
                  checked={(draft.params as any).randomTint === true}
                  onChange={(event) => updateParams({ randomTint: event.target.checked })}
                />
                <span>Enable RGB variation</span>
              </label>
              <div className="inspector-grid-2">
                <label className="field">
                  <span>Red Min</span>
                  <ValidatedNumberInput
                    aria-label="Red Min"
                    data-testid="formation-draft-tint-min-r"
                    value={numberParam('tintMinR', 20)}
                    onCommit={(next) => updateParams({ tintMinR: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
                <label className="field">
                  <span>Red Max</span>
                  <ValidatedNumberInput
                    aria-label="Red Max"
                    data-testid="formation-draft-tint-max-r"
                    value={numberParam('tintMaxR', 255)}
                    onCommit={(next) => updateParams({ tintMaxR: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
              </div>
              <div className="inspector-grid-2">
                <label className="field">
                  <span>Green Min</span>
                  <ValidatedNumberInput
                    aria-label="Green Min"
                    data-testid="formation-draft-tint-min-g"
                    value={numberParam('tintMinG', 20)}
                    onCommit={(next) => updateParams({ tintMinG: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
                <label className="field">
                  <span>Green Max</span>
                  <ValidatedNumberInput
                    aria-label="Green Max"
                    data-testid="formation-draft-tint-max-g"
                    value={numberParam('tintMaxG', 255)}
                    onCommit={(next) => updateParams({ tintMaxG: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
              </div>
              <div className="inspector-grid-2">
                <label className="field">
                  <span>Blue Min</span>
                  <ValidatedNumberInput
                    aria-label="Blue Min"
                    data-testid="formation-draft-tint-min-b"
                    value={numberParam('tintMinB', 20)}
                    onCommit={(next) => updateParams({ tintMinB: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
                <label className="field">
                  <span>Blue Max</span>
                  <ValidatedNumberInput
                    aria-label="Blue Max"
                    data-testid="formation-draft-tint-max-b"
                    value={numberParam('tintMaxB', 255)}
                    onCommit={(next) => updateParams({ tintMaxB: Math.max(0, Math.min(255, Math.round(next || 0))) })}
                    disabled={(draft.params as any).randomTint !== true}
                  />
                </label>
              </div>
            </details>
          </>
        ) : (
          <div className="muted" data-testid="formation-draft-non-grid-hint">
            Adjust the preset parameters, then Create.
          </div>
        )}

        <div className="toolbar-actions" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <button className="button" type="button" data-testid="formation-draft-cancel" onClick={() => dispatch({ type: 'cancel-formation-draft' })}>
            Cancel
          </button>
          <button className="button" type="button" data-testid="formation-draft-create" onClick={() => dispatch({ type: 'commit-formation-draft' })}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
