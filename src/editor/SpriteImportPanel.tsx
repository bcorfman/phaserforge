import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { ImportedEntityDraft, useEditorStore } from './EditorStore';
import { EntitySpec, SpriteAssetSource } from '../model/types';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { getSceneWorld } from './sceneWorld';
import { clampHitboxToEntity, computeHitboxFromImageData } from './hitboxAuto';

type LoadedImage = {
  src: string;
  name: string;
  mimeType?: string;
  width: number;
  height: number;
  image: HTMLImageElement;
  sourceKind: 'embedded' | 'path';
};

function loadImageMetadata(src: string, name: string, mimeType: string | undefined, sourceKind: LoadedImage['sourceKind']): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        src,
        name,
        mimeType,
        width: image.naturalWidth,
        height: image.naturalHeight,
        image,
        sourceKind,
      });
    };
    image.onerror = () => reject(new Error('Unable to load image'));
    image.src = src;
  });
}

function makeEntityId(index: number): string {
  return `e-import-${Date.now()}-${index}`;
}

export function SpriteImportPanel() {
  const { state, dispatch } = useEditorStore();
  const [sourceMode, setSourceMode] = useState<'embedded' | 'path'>('embedded');
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [assetPath, setAssetPath] = useState('');
  const [imageType, setImageType] = useState<'image' | 'spritesheet'>('image');
  const [frameWidth, setFrameWidth] = useState(32);
  const [frameHeight, setFrameHeight] = useState(32);
  const [autoHitbox, setAutoHitbox] = useState(true);
  const [selectedFrames, setSelectedFrames] = useState<number[]>([0]);
  const [error, setError] = useState<string | undefined>();
  const world = getSceneWorld(state.scene);

  useEffect(() => {
    if (!loadedImage) return;
    setFrameWidth(Math.max(1, Math.min(loadedImage.width, frameWidth || loadedImage.width)));
    setFrameHeight(Math.max(1, Math.min(loadedImage.height, frameHeight || loadedImage.height)));
  }, [loadedImage]);

  const grid = useMemo(() => {
    if (!loadedImage || imageType !== 'spritesheet') return null;
    const columns = Math.max(1, Math.floor(loadedImage.width / Math.max(1, frameWidth)));
    const rows = Math.max(1, Math.floor(loadedImage.height / Math.max(1, frameHeight)));
    return { columns, rows, total: columns * rows };
  }, [frameHeight, frameWidth, imageType, loadedImage]);

  const toggleFrame = (frameIndex: number) => {
    setSelectedFrames((current) => current.includes(frameIndex)
      ? current.filter((value) => value !== frameIndex)
      : [...current, frameIndex].sort((a, b) => a - b));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read file'));
        reader.readAsDataURL(file);
      });
      const metadata = await loadImageMetadata(dataUrl, file.name, file.type, 'embedded');
      setLoadedImage(metadata);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import file');
    }
  };

  const handleLoadPath = async () => {
    try {
      const metadata = await loadImageMetadata(assetPath, assetPath.split('/').pop() ?? assetPath, undefined, 'path');
      setLoadedImage(metadata);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load path');
    }
  };

  const importSprites = () => {
    if (!loadedImage) return;

    const source: SpriteAssetSource = loadedImage.sourceKind === 'embedded'
      ? {
          kind: 'embedded',
          dataUrl: loadedImage.src,
          originalName: loadedImage.name,
          mimeType: loadedImage.mimeType,
        }
      : {
          kind: 'path',
          path: loadedImage.src,
        };

    const frames = imageType === 'spritesheet' && grid
      ? (selectedFrames.length > 0 ? selectedFrames : [0])
      : [0];

    const baseX = world.width / 2;
    const baseY = world.height / 2;
    const drafts: ImportedEntityDraft[] = frames.map((frameIndex, index) => {
      const columns = grid?.columns ?? 1;
      const frameX = (frameIndex % columns) * frameWidth;
      const frameY = Math.floor(frameIndex / columns) * frameHeight;
      const entityWidth = imageType === 'spritesheet' ? frameWidth : loadedImage.width;
      const entityHeight = imageType === 'spritesheet' ? frameHeight : loadedImage.height;
      const hitbox = autoHitbox ? computeAutoHitbox(loadedImage.image, {
        frameX,
        frameY,
        frameWidth: entityWidth,
        frameHeight: entityHeight,
      }) : undefined;
      const entity: EntitySpec = {
        id: makeEntityId(index),
        name: `${loadedImage.name}-${frameIndex}`,
        x: baseX + (index % 4) * (frameWidth + 12),
        y: baseY + Math.floor(index / 4) * (frameHeight + 12),
        width: entityWidth,
        height: entityHeight,
        hitbox,
        rotationDeg: 0,
        asset: {
          source,
          imageType,
          grid: imageType === 'spritesheet' && grid
            ? {
                frameWidth,
                frameHeight,
                columns: grid.columns,
                rows: grid.rows,
              }
            : undefined,
          frame: imageType === 'spritesheet'
            ? {
                kind: 'spritesheet-frame',
                frameIndex,
                frameX,
                frameY,
              }
            : {
                kind: 'single',
              },
        },
      };
      return {
        entity: resolveEntityDefaults(entity),
        addToSelectedGroup: state.selection.kind === 'group',
      };
    });

    dispatch({ type: 'import-entities', drafts });
    dispatch({ type: 'export-yaml' });
  };

  return (
    <div className="inspector-block" data-testid="sprite-import-panel">
      <div className="inspector-title">Import Sprites</div>
      <label className="field">
        <span>Source</span>
        <select
          aria-label="Sprite import source"
          data-testid="sprite-import-source-select"
          value={sourceMode}
          onChange={(e) => setSourceMode(e.target.value as 'embedded' | 'path')}
        >
          <option value="embedded">Embedded File</option>
          <option value="path">Asset Path</option>
        </select>
      </label>
      {sourceMode === 'embedded' ? (
        <label className="field">
          <span>Image File</span>
          <input
            aria-label="Sprite image file"
            data-testid="sprite-file-input"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
      ) : (
        <div className="field">
          <span>Asset Path</span>
          <input
            aria-label="Sprite asset path"
            data-testid="sprite-path-input"
            type="text"
            value={assetPath}
            onChange={(e) => setAssetPath(e.target.value)}
            placeholder="/images/my-spritesheet.png"
          />
          <button className="button" data-testid="load-sprite-path-button" type="button" onClick={() => void handleLoadPath()}>
            Load Path
          </button>
        </div>
      )}
      {loadedImage && (
        <>
          <div className="inspector-row" data-testid="sprite-import-meta">
            {loadedImage.name} {loadedImage.width} x {loadedImage.height}
          </div>
          <label className="field">
            <span>Auto Hitbox</span>
            <input
              aria-label="Auto Hitbox"
              data-testid="sprite-import-auto-hitbox-input"
              type="checkbox"
              checked={autoHitbox}
              onChange={(e) => setAutoHitbox(e.target.checked)}
            />
          </label>
          <label className="field">
            <span>Mode</span>
            <select
              aria-label="Sprite import mode"
              data-testid="sprite-import-mode-select"
              value={imageType}
              onChange={(e) => setImageType(e.target.value as 'image' | 'spritesheet')}
            >
              <option value="image">Single Sprite</option>
              <option value="spritesheet">Spritesheet</option>
            </select>
          </label>
          {imageType === 'spritesheet' && (
            <>
              <label className="field">
                <span>Frame Width</span>
                <input
                  aria-label="Frame Width"
                  data-testid="spritesheet-frame-width-input"
                  type="number"
                  min={1}
                  value={frameWidth}
                  onChange={(e) => setFrameWidth(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label className="field">
                <span>Frame Height</span>
                <input
                  aria-label="Frame Height"
                  data-testid="spritesheet-frame-height-input"
                  type="number"
                  min={1}
                  value={frameHeight}
                  onChange={(e) => setFrameHeight(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <div className="inspector-row">
                Frames: {grid?.columns ?? 1} x {grid?.rows ?? 1}
              </div>
              <div className="member-list" data-testid="spritesheet-frame-list">
                {Array.from({ length: Math.min(grid?.total ?? 0, 64) }, (_, frameIndex) => (
                  <button
                    key={frameIndex}
                    className={`tag-button ${selectedFrames.includes(frameIndex) ? 'active' : ''}`}
                    data-testid={`spritesheet-frame-${frameIndex}`}
                    type="button"
                    onClick={() => toggleFrame(frameIndex)}
                  >
                    {frameIndex}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="button" data-testid="import-sprites-button" type="button" onClick={importSprites}>
            Import Sprite{imageType === 'spritesheet' ? 's' : ''}
          </button>
        </>
      )}
      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}

function computeAutoHitbox(
  image: HTMLImageElement,
  params: { frameX: number; frameY: number; frameWidth: number; frameHeight: number }
): EntitySpec['hitbox'] {
  const canvas = document.createElement('canvas');
  canvas.width = params.frameWidth;
  canvas.height = params.frameHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { x: 0, y: 0, width: params.frameWidth, height: params.frameHeight };
  }

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      params.frameX,
      params.frameY,
      params.frameWidth,
      params.frameHeight,
      0,
      0,
      params.frameWidth,
      params.frameHeight
    );
    const imageData = ctx.getImageData(0, 0, params.frameWidth, params.frameHeight);
    const computed = computeHitboxFromImageData(imageData, { alphaThreshold: 1 });
    const raw = computed ?? { x: 0, y: 0, width: params.frameWidth, height: params.frameHeight };
    return clampHitboxToEntity(raw, { width: params.frameWidth, height: params.frameHeight });
  } catch {
    return { x: 0, y: 0, width: params.frameWidth, height: params.frameHeight };
  }
}
