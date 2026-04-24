import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackgroundLayerSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { getSceneWorld } from './sceneWorld';
import { ValidatedNumberInput, ValidatedOptionalNumberInput } from './ValidatedNumberInput';

function clampIndex(value: number, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.max(0, Math.min(maxExclusive - 1, value));
}

function parseTintHex(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
  return Number.parseInt(normalized, 16);
}

function formatTintHex(value: number | undefined): string {
  if (value == null) return '';
  const hex = Math.max(0, Math.min(0xffffff, Math.floor(value))).toString(16).padStart(6, '0');
  return `#${hex}`;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function BackgroundLayersPanel({
  project,
  sceneId,
  layers,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  sceneId: string;
  layers: BackgroundLayerSpec[];
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const foldouts = useInspectorFoldouts();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const world = useMemo(() => getSceneWorld(project.scenes[sceneId]), [project.scenes, sceneId]);
  const selectedLayer = layers[selectedIndex];

  useEffect(() => {
    setSelectedIndex((prev) => clampIndex(prev, layers.length));
  }, [layers.length]);

  const assetOptions = useMemo(() => Object.keys(project.assets.images ?? {}).sort(), [project.assets.images]);

  const addLayerFromPickedFile = async (file: File) => {
    const dataUrl = await readAsDataUrl(file);
    dispatch({
      type: 'add-background-layer-from-file',
      file: { dataUrl, originalName: file.name, mimeType: file.type || undefined },
      defaults: { layout: 'cover' },
    });
    setSelectedIndex(layers.length);
  };

  return (
    <div className="inspector-block" data-testid="background-layers-panel">
      <div className="inspector-title">Scene: {sceneId}</div>
      <InspectorFoldout
        title="Background Layers"
        open={foldouts.isOpen('scene.backgroundLayers', true)}
        onToggle={() => foldouts.toggle('scene.backgroundLayers', true)}
        testId="background-layers-foldout"
      >
        {layers.length === 0 && (
          <div className="inspector-row muted">
            No background layers yet. Add an image to render behind sprites in Edit and Play mode.
          </div>
        )}

        {layers.map((layer, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div key={`${layer.assetId}:${index}`} className="inspector-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className={`button ${isSelected ? 'active' : ''}`}
                data-testid={`background-layer-select-${index}`}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedIndex(index)}
                style={{ flex: 1, textAlign: 'left' }}
              >
                {index + 1}) {layer.assetId || '(missing asset)'} · {layer.layout}
              </button>
              <button
                className="button button-compact"
                data-testid={`background-layer-up-${index}`}
                type="button"
                disabled={disabled || index === 0}
                onClick={() => dispatch({ type: 'move-background-layer', fromIndex: index, toIndex: index - 1 })}
              >
                ↑
              </button>
              <button
                className="button button-compact"
                data-testid={`background-layer-down-${index}`}
                type="button"
                disabled={disabled || index === layers.length - 1}
                onClick={() => dispatch({ type: 'move-background-layer', fromIndex: index, toIndex: index + 1 })}
              >
                ↓
              </button>
              <button
                className="button button-danger button-compact"
                data-testid={`background-layer-remove-${index}`}
                type="button"
                disabled={disabled}
                onClick={() => dispatch({ type: 'remove-background-layer', index })}
              >
                ✕
              </button>
            </div>
          );
        })}

        <div className="inspector-row">
          <button
            className="button"
            data-testid="background-add-layer-button"
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            + Add Layer
          </button>
          <input
            aria-hidden="true"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              e.currentTarget.value = '';
              await addLayerFromPickedFile(file);
            }}
          />
        </div>

        {selectedLayer && (
          <>
            <div className="inspector-row" style={{ marginTop: 10 }}>
              <strong>Selected Layer</strong>
            </div>
            <label className="field">
              <span>assetId</span>
              {assetOptions.length > 0 ? (
                <select
                  data-testid="background-layer-assetId"
                  value={selectedLayer.assetId}
                  disabled={disabled}
                  onChange={(e) => dispatch({ type: 'update-background-layer', index: selectedIndex, patch: { assetId: e.target.value } })}
                >
                  {assetOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  data-testid="background-layer-assetId-input"
                  value={selectedLayer.assetId}
                  disabled={disabled}
                  onChange={(e) => dispatch({ type: 'update-background-layer', index: selectedIndex, patch: { assetId: e.target.value } })}
                />
              )}
            </label>
            <label className="field">
              <span>layout</span>
              <select
                data-testid="background-layer-layout"
                value={selectedLayer.layout}
                disabled={disabled}
                onChange={(e) => {
                  const layout = e.target.value as BackgroundLayerSpec['layout'];
                  const patch: Partial<BackgroundLayerSpec> = { layout };
                  if (layout === 'tile') {
                    patch.x = 0;
                    patch.y = 0;
                  } else {
                    patch.x = world.width / 2;
                    patch.y = world.height / 2;
                  }
                  dispatch({ type: 'update-background-layer', index: selectedIndex, patch });
                }}
              >
                <option value="stretch">stretch</option>
                <option value="cover">cover</option>
                <option value="contain">contain</option>
                <option value="center">center</option>
                <option value="tile">tile</option>
              </select>
            </label>

            <div className="inspector-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field">
                <span>depth</span>
                <ValidatedNumberInput
                  data-testid="background-layer-depth"
                  value={selectedLayer.depth}
                  disabled={disabled}
                  onCommit={(value) => dispatch({ type: 'update-background-layer', index: selectedIndex, patch: { depth: value } })}
                />
              </label>
              <label className="field">
                <span>alpha</span>
                <ValidatedOptionalNumberInput
                  data-testid="background-layer-alpha"
                  value={selectedLayer.alpha}
                  disabled={disabled}
                  onCommit={(value) => dispatch({ type: 'update-background-layer', index: selectedIndex, patch: { alpha: value } })}
                />
              </label>
            </div>

            <div className="inspector-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field">
                <span>scrollFactor.x</span>
                <ValidatedOptionalNumberInput
                  data-testid="background-layer-scroll-x"
                  value={selectedLayer.scrollFactor?.x}
                  disabled={disabled}
                  onCommit={(value) =>
                    dispatch({
                      type: 'update-background-layer',
                      index: selectedIndex,
                      patch: { scrollFactor: value == null ? undefined : { x: value, y: selectedLayer.scrollFactor?.y ?? value } },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>scrollFactor.y</span>
                <ValidatedOptionalNumberInput
                  data-testid="background-layer-scroll-y"
                  value={selectedLayer.scrollFactor?.y}
                  disabled={disabled}
                  onCommit={(value) =>
                    dispatch({
                      type: 'update-background-layer',
                      index: selectedIndex,
                      patch: { scrollFactor: value == null ? undefined : { x: selectedLayer.scrollFactor?.x ?? value, y: value } },
                    })
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>tint</span>
              <input
                data-testid="background-layer-tint"
                placeholder="#rrggbb"
                value={formatTintHex(selectedLayer.tint)}
                disabled={disabled}
                onChange={(e) => {
                  const tint = parseTintHex(e.target.value);
                  dispatch({ type: 'update-background-layer', index: selectedIndex, patch: { tint } });
                }}
              />
            </label>
          </>
        )}
      </InspectorFoldout>
    </div>
  );
}

