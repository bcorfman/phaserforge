import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { ProjectSpec } from '../model/types';
import type { EditorAction, Selection } from './EditorStore';
import { getAssetReferences, type AssetKind } from './assetReferences';
import { DEMO_PACK_ASSET_MANIFEST } from './demoPackAssets';
import { ASSET_DRAG_MIME } from './dragAssets';
import { fileToDataUrl } from './fileDataUrl';
import { loadImageMetadataFromFile, type LoadedImageMetadata } from './imageMetadata';
import { projectPersistence } from './projectPersistence';
import { inlinePreviewUrlForAssetSource } from '../cloud/assetUrls';

const DEVICE_FONT_EXTENSIONS = /\.(ttf|otf|woff|woff2)$/i;

function isFontFilename(name: string): boolean {
  return DEVICE_FONT_EXTENSIONS.test(name);
}

async function readAsDataUrl(file: File): Promise<string> {
  return fileToDataUrl(file);
}

type LoadedImage = {
  src: string;
  name: string;
  mimeType?: string;
  width: number;
  height: number;
};
function toLoadedImage(meta: LoadedImageMetadata): LoadedImage {
  return { src: meta.src, name: meta.name, mimeType: meta.mimeType, width: meta.width, height: meta.height };
}

type AssetTab = 'images' | 'audio' | 'fonts';

function displayLabel(assetId: string, name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : assetId;
}

function usageBadgesForAudio(project: ProjectSpec, assetId: string): Array<'MUS' | 'AMB'> {
  let hasMusic = false;
  let hasAmb = false;
  for (const scene of Object.values(project.scenes)) {
    if (scene.music?.assetId === assetId) hasMusic = true;
    if ((scene.ambience ?? []).some((a) => a.assetId === assetId)) hasAmb = true;
  }
  return [
    ...(hasMusic ? ['MUS' as const] : []),
    ...(hasAmb ? ['AMB' as const] : []),
  ];
}

export function AssetsDock({
  project,
  sceneId,
  selection,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  sceneId: string;
  selection: Selection;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  void sceneId;
  void selection;
  const [tab, setTab] = useState<AssetTab>('images');
  const [search, setSearch] = useState('');
  const [showImageThumbnails, setShowImageThumbnails] = useState(true);
  const [thumbnailPrefHydrated, setThumbnailPrefHydrated] = useState(false);
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const addMenuRootRef = useRef<HTMLDivElement | null>(null);
  const deviceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | undefined>();
  const [demoPackImporting, setDemoPackImporting] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ assetKind: AssetKind; assetId: string; x: number; y: number } | null>(null);
  const rowMenuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void projectPersistence.loadPreferencesRecord().then((preferences) => {
      if (cancelled) return;
      setShowImageThumbnails(preferences?.assetsDockShowThumbnails ?? true);
      setThumbnailPrefHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!thumbnailPrefHydrated) return;
    void projectPersistence.updatePreferencesRecord({ assetsDockShowThumbnails: showImageThumbnails });
  }, [showImageThumbnails, thumbnailPrefHydrated]);

  const normalizedSearch = search.trim().toLowerCase();

  const rows = useMemo(() => {
    const matches = (id: string, name?: string) => {
      if (!normalizedSearch) return true;
      const label = displayLabel(id, name).toLowerCase();
      return label.includes(normalizedSearch) || id.toLowerCase().includes(normalizedSearch);
    };

    if (tab === 'audio') {
      const sounds = project.audio?.sounds ?? {};
      return Object.keys(sounds)
        .sort()
        .filter((id) => matches(id, sounds[id]?.name))
        .map((id) => ({ kind: 'audio' as const, id }));
    }

    if (tab === 'fonts') {
      const fonts = project.assets.fonts ?? {};
      return Object.keys(fonts)
        .sort()
        .filter((id) => matches(id, fonts[id]?.name))
        .map((id) => ({ kind: 'font' as const, id }));
    }

    const images = project.assets.images ?? {};
    const sheets = project.assets.spriteSheets ?? {};
    const imageIds = Object.keys(images).sort().filter((id) => matches(id, images[id]?.name)).map((id) => ({ kind: 'image' as const, id }));
    const sheetIds = Object.keys(sheets).sort().filter((id) => matches(id, sheets[id]?.name)).map((id) => ({ kind: 'spritesheet' as const, id }));
    return [...imageIds, ...sheetIds];
  }, [normalizedSearch, project, tab]);

  const openAddMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAddMenu({ x: Math.max(8, rect.right - 240), y: rect.bottom + 8 });
    setImportError(undefined);
  };

  const importFromDevice = () => {
    setAddMenu(null);
    setImportError(undefined);
    deviceFileInputRef.current?.click();
  };

  const onDeviceFilesPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setImportError(undefined);
    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        const isFont = isFontFilename(lower);
        if (file.type.startsWith('image/')) {
          const dataUrl = await readAsDataUrl(file);
          const meta = toLoadedImage(await loadImageMetadataFromFile(file, dataUrl));
          dispatch({
            type: 'add-image-asset-from-file',
            file: { dataUrl, originalName: file.name, mimeType: file.type || undefined, width: meta.width, height: meta.height },
          } as any);
        } else if (file.type.startsWith('audio/')) {
          const dataUrl = await readAsDataUrl(file);
          dispatch({ type: 'add-audio-asset-from-file', file: { dataUrl, originalName: file.name, mimeType: file.type || undefined } } as any);
        } else if (isFont) {
          const dataUrl = await readAsDataUrl(file);
          dispatch({ type: 'add-font-asset-from-file', file: { dataUrl, originalName: file.name, mimeType: file.type || undefined } } as any);
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import files');
    }
  };

  const importDemoPack = async () => {
    setAddMenu(null);
    setImportError(undefined);
    if (demoPackImporting) return;
    setDemoPackImporting(true);
    try {
      dispatch({ type: 'import-demo-pack-assets', entries: DEMO_PACK_ASSET_MANIFEST } as any);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import demo pack');
    } finally {
      setDemoPackImporting(false);
    }
  };

  const beginDrag = (assetKind: AssetKind, assetId: string, event: React.DragEvent) => {
    // Be resilient: some browsers/contexts can throw for custom MIME types.
    // Ensure we still provide a usable payload via text/plain in that case.
    try {
      event.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ assetKind, assetId }));
    } catch {
      // ignore
    }
    try {
      event.dataTransfer.setData('text/plain', `${assetKind}:${assetId}`);
    } catch {
      // ignore
    }
    try {
      event.dataTransfer.effectAllowed = 'copy';
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!rowMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = rowMenuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setRowMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRowMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rowMenu]);

  useEffect(() => {
    if (!addMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = addMenuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setAddMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addMenu]);

  const onRename = (assetKind: AssetKind, assetId: string) => {
    const existing = assetKind === 'audio'
      ? project.audio?.sounds?.[assetId]
      : assetKind === 'image'
        ? project.assets.images?.[assetId]
        : assetKind === 'spritesheet'
          ? project.assets.spriteSheets?.[assetId]
          : project.assets.fonts?.[assetId];
    const current = existing?.name ?? '';
    const next = window.prompt('Asset display name', current);
    if (next == null) return;
    dispatch({ type: 'set-asset-display-name', assetKind, assetId, name: next } as any);
  };

  const onDelete = (assetKind: AssetKind, assetId: string) => {
    const refs = getAssetReferences(project, assetKind, assetId);
    if (refs.count > 0) {
      dispatch({ type: 'set-error', error: `Cannot delete ${assetKind} asset "${assetId}" — it is still referenced (${refs.count}).` } as any);
      return;
    }
    const ok = window.confirm(`Delete ${assetKind} asset "${assetId}"?`);
    if (!ok) return;
    dispatch({ type: 'remove-asset', assetKind, assetId } as any);
  };

  return (
    <div className="assets-dock" data-testid="assets-dock">
      <div className="assets-dock-header">
        <div className="assets-dock-title">Assets</div>
        <button className="button button-compact" type="button" disabled={disabled} onClick={openAddMenu} data-testid="assets-dock-add-button">
          + Add
        </button>
      </div>

      <input
        ref={deviceFileInputRef}
        data-testid="assets-dock-device-file-input"
        type="file"
        style={{ display: 'none' }}
        multiple
        accept="image/*,audio/*,.ttf,.otf,.woff,.woff2"
        onChange={(e) => void onDeviceFilesPicked(e)}
        disabled={disabled}
      />

      {addMenu ? (
        <div
          ref={addMenuRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: addMenu.x, top: addMenu.y, zIndex: 51, minWidth: 220 }}
          data-testid="assets-dock-add-menu"
          role="menu"
        >
          <div className="scene-graph-menu-hint">+ Add</div>
          <button
            type="button"
            className="scene-graph-menu-item"
            data-testid="assets-dock-add-menu-from-device"
            disabled={disabled}
            onClick={importFromDevice}
          >
            From device...
          </button>
          <button
            type="button"
            className="scene-graph-menu-item"
            data-testid="assets-dock-add-menu-from-demo-pack"
            disabled={disabled || demoPackImporting}
            onClick={() => void importDemoPack()}
          >
            From demo pack
          </button>
        </div>
      ) : null}

      <div className="assets-dock-list" role="list">
        <div className="assets-dock-list-controls">
          <div className="assets-dock-controls">
            <input
              className="text-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search assets"
              data-testid="assets-dock-search"
            />
            <div className="assets-dock-tabs" role="tablist" aria-label="Asset type">
              <button className={`button button-compact ${tab === 'images' ? 'active' : ''}`} type="button" onClick={() => setTab('images')} role="tab" aria-selected={tab === 'images'} data-testid="assets-dock-tab-images">
                Images
              </button>
              <button className={`button button-compact ${tab === 'audio' ? 'active' : ''}`} type="button" onClick={() => setTab('audio')} role="tab" aria-selected={tab === 'audio'} data-testid="assets-dock-tab-audio">
                Audio
              </button>
              <button className={`button button-compact ${tab === 'fonts' ? 'active' : ''}`} type="button" onClick={() => setTab('fonts')} role="tab" aria-selected={tab === 'fonts'} data-testid="assets-dock-tab-fonts">
                Fonts
              </button>
            </div>
          </div>
          {tab === 'images' ? (
            <label className="assets-dock-thumbnails-toggle" data-testid="assets-dock-show-thumbnails">
              <input
                type="checkbox"
                checked={showImageThumbnails}
                onChange={(e) => setShowImageThumbnails(e.target.checked)}
              />
              <span>Show thumbnails</span>
            </label>
          ) : null}
          {importError ? <div className="muted">{importError}</div> : null}
        </div>
        {rows.length === 0 ? (
          <div className="muted">No assets. Select &quot;+ Add&quot; to import.</div>
        ) : rows.map((row) => {
          const assetKind = row.kind;
          const assetId = row.id;
          const asset = assetKind === 'audio'
            ? project.audio?.sounds?.[assetId]
            : assetKind === 'image'
              ? project.assets.images?.[assetId]
              : assetKind === 'spritesheet'
                ? project.assets.spriteSheets?.[assetId]
                : project.assets.fonts?.[assetId];
          const label = displayLabel(assetId, asset?.name);
          const audioBadges = assetKind === 'audio' ? usageBadgesForAudio(project, assetId) : [];
          const sheetBadge = assetKind === 'spritesheet' ? ['SHEET'] : [];
          const thumbnailSrc = (assetKind === 'image' || assetKind === 'spritesheet') && asset?.source
            ? inlinePreviewUrlForAssetSource(asset.source)
            : '';

          return (
            <div key={`${assetKind}:${assetId}`} className="assets-dock-row" data-testid={`assets-dock-row-${assetKind}-${assetId}`}>
              <button
                type="button"
                className="list-item"
                draggable={!disabled}
                onDragStart={(e) => beginDrag(assetKind, assetId, e)}
                onDoubleClick={() => {
                  if (disabled) return;
                  if (assetKind === 'image' || assetKind === 'spritesheet') {
                    dispatch({ type: 'create-entity-from-asset', assetKind, assetId } as any);
                  }
                }}
                data-testid={`assets-dock-item-${assetKind}-${assetId}`}
                style={{ flex: 1, textAlign: 'left', opacity: disabled ? 0.7 : 1 }}
              >
                {tab === 'images' && showImageThumbnails && (assetKind === 'image' || assetKind === 'spritesheet') && thumbnailSrc ? (
                  <span className="assets-dock-thumb" aria-hidden="true">
                    <img src={thumbnailSrc} alt="" draggable={false} />
                  </span>
                ) : null}
                <span className="assets-dock-label">{label}</span>
                <span className="assets-dock-badges">
                  {sheetBadge.map((b) => <span key={b} className="badge badge-inline">{b}</span>)}
                  {audioBadges.map((b) => <span key={b} className="badge badge-inline">{b}</span>)}
                </span>
              </button>
              <button
                className="scene-graph-button"
                type="button"
                disabled={disabled}
                aria-label="Asset menu"
                data-testid={`assets-dock-menu-${assetKind}-${assetId}`}
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const menuWidth = 240;
                  const menuHeight = 220;
                  const padding = 12;
                  const x = Math.min(Math.max(padding, rect.left), window.innerWidth - menuWidth - padding);
                  const y = Math.min(Math.max(padding, rect.bottom + 6), window.innerHeight - menuHeight - padding);
                  setRowMenu({ assetKind, assetId, x, y });
                }}
              >
                ⋯
              </button>
            </div>
          );
        })}
      </div>

      {rowMenu && (
        <div
          ref={rowMenuRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: rowMenu.x, top: rowMenu.y, zIndex: 2000, minWidth: 220 }}
          data-testid="assets-dock-row-menu"
          role="menu"
        >
          <div className="scene-graph-menu-hint">{rowMenu.assetKind}:{rowMenu.assetId}</div>
          {(rowMenu.assetKind === 'image' || rowMenu.assetKind === 'spritesheet') && (
            <>
              <button
                type="button"
                className="scene-graph-menu-item"
                role="menuitem"
                data-testid="assets-dock-row-menu-create-formation"
                onClick={() => {
                  const next = rowMenu;
                  setRowMenu(null);
                  dispatch({
                    type: 'begin-formation-draft',
                    template: { kind: 'asset', assetKind: next.assetKind, assetId: next.assetId },
                  } as any);
                }}
              >
                Create formation from…
              </button>
              <div className="scene-graph-menu-divider" />
            </>
          )}
          <button
            type="button"
            className="scene-graph-menu-item"
            role="menuitem"
            data-testid="assets-dock-row-menu-rename"
            onClick={() => {
              const next = rowMenu;
              setRowMenu(null);
              onRename(next.assetKind, next.assetId);
            }}
          >
            Rename…
          </button>
          <div className="scene-graph-menu-divider" />
          <button
            type="button"
            className="scene-graph-menu-item scene-graph-menu-danger"
            role="menuitem"
            data-testid="assets-dock-row-menu-delete"
            onClick={() => {
              const next = rowMenu;
              setRowMenu(null);
              onDelete(next.assetKind, next.assetId);
            }}
          >
            Delete…
          </button>
        </div>
      )}

    </div>
  );
}
