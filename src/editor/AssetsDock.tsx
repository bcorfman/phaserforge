import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { AssetFileSource, ProjectSpec } from '../model/types';
import type { EditorAction, Selection } from './EditorStore';
import { getAssetReferences, type AssetKind } from './assetReferences';
import { ASSET_DRAG_MIME } from './dragAssets';
import { SpriteImportPanelView } from './SpriteImportPanel';

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

type LoadedImage = {
  src: string;
  name: string;
  mimeType?: string;
  width: number;
  height: number;
};

function loadImageMetadata(src: string, name: string, mimeType?: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ src, name, mimeType, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Unable to load image'));
    image.src = src;
  });
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
  const [tab, setTab] = useState<AssetTab>('images');
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importKind, setImportKind] = useState<'image' | 'spritesheet' | 'audio' | 'font'>('image');
  const [sourceMode, setSourceMode] = useState<'embedded' | 'path'>('embedded');
  const [pathDraft, setPathDraft] = useState('');
  const [fileError, setFileError] = useState<string | undefined>();
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [frameWidth, setFrameWidth] = useState(32);
  const [frameHeight, setFrameHeight] = useState(32);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rowMenu, setRowMenu] = useState<{ assetKind: AssetKind; assetId: string; x: number; y: number } | null>(null);
  const rowMenuRootRef = useRef<HTMLDivElement | null>(null);
  const [relinkOpen, setRelinkOpen] = useState<{ assetKind: AssetKind; assetId: string } | null>(null);
  const [relinkSourceMode, setRelinkSourceMode] = useState<'embedded' | 'path'>('path');
  const [relinkPathDraft, setRelinkPathDraft] = useState('');
  const [relinkError, setRelinkError] = useState<string | undefined>();
  const relinkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [advancedImportOpen, setAdvancedImportOpen] = useState(false);

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

  const startImport = () => {
    setImportOpen(true);
    setFileError(undefined);
    setLoadedImage(null);
    setPathDraft('');
  };

  const triggerFilePick = () => fileInputRef.current?.click();

  const onFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setFileError(undefined);
    try {
      const dataUrl = await readAsDataUrl(file);
      if (importKind === 'image') {
        dispatch({ type: 'add-image-asset-from-file', file: { dataUrl, originalName: file.name, mimeType: file.type || undefined } } as any);
        setImportOpen(false);
        return;
      }
      if (importKind === 'audio') {
        dispatch({ type: 'add-audio-asset-from-file', file: { dataUrl, originalName: file.name, mimeType: file.type || undefined } } as any);
        setImportOpen(false);
        return;
      }
      if (importKind === 'font') {
        dispatch({ type: 'add-font-asset-from-file', file: { dataUrl, originalName: file.name, mimeType: file.type || undefined } } as any);
        setImportOpen(false);
        return;
      }

      const meta = await loadImageMetadata(dataUrl, file.name, file.type || undefined);
      setLoadedImage(meta);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unable to import file');
    }
  };

  const commitPathImport = async () => {
    const path = pathDraft.trim();
    if (!path) return;
    if (importKind === 'image') {
      dispatch({ type: 'add-image-asset-from-path', path } as any);
      setImportOpen(false);
      return;
    }
    if (importKind === 'audio') {
      dispatch({ type: 'add-audio-asset-from-path', path } as any);
      setImportOpen(false);
      return;
    }
    if (importKind === 'font') {
      dispatch({ type: 'add-font-asset-from-path', path } as any);
      setImportOpen(false);
      return;
    }
    // spritesheet path import needs grid; require metadata is unavailable here, so infer a 1x1 sheet.
    dispatch({
      type: 'add-spritesheet-asset-from-path',
      path,
      grid: { frameWidth: Math.max(1, frameWidth), frameHeight: Math.max(1, frameHeight), columns: 1, rows: 1 },
    } as any);
    setImportOpen(false);
  };

  const commitSpritesheetImport = () => {
    if (!loadedImage) return;
    const columns = Math.max(1, Math.floor(loadedImage.width / Math.max(1, frameWidth)));
    const rows = Math.max(1, Math.floor(loadedImage.height / Math.max(1, frameHeight)));
    dispatch({
      type: 'add-spritesheet-asset-from-file',
      file: { dataUrl: loadedImage.src, originalName: loadedImage.name, mimeType: loadedImage.mimeType },
      grid: { frameWidth: Math.max(1, frameWidth), frameHeight: Math.max(1, frameHeight), columns, rows },
    } as any);
    setImportOpen(false);
    setLoadedImage(null);
  };

  const beginDrag = (assetKind: AssetKind, assetId: string, event: React.DragEvent) => {
    try {
      event.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ assetKind, assetId }));
      event.dataTransfer.setData('text/plain', `${assetKind}:${assetId}`);
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
    if (!relinkOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRelinkOpen(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [relinkOpen]);

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

  const openRelink = (assetKind: AssetKind, assetId: string) => {
    setRelinkError(undefined);
    setRelinkPathDraft('');
    setRelinkSourceMode('path');
    setRelinkOpen({ assetKind, assetId });
  };

  const applyRelink = async () => {
    if (!relinkOpen) return;
    setRelinkError(undefined);
    try {
      const { assetKind, assetId } = relinkOpen;
      let source: AssetFileSource;
      if (relinkSourceMode === 'path') {
        const nextPath = relinkPathDraft.trim();
        if (!nextPath) {
          setRelinkError('Enter an asset path.');
          return;
        }
        source = { kind: 'path', path: nextPath };
      } else {
        const input = relinkFileInputRef.current;
        const file = input?.files?.[0];
        if (!file) {
          setRelinkError('Choose a file.');
          return;
        }
        const dataUrl = await readAsDataUrl(file);
        source = {
          kind: 'embedded',
          dataUrl,
          originalName: file.name,
          ...(file.type ? { mimeType: file.type } : {}),
        };
      }
      dispatch({ type: 'relink-asset-source', assetKind, assetId, source } as any);
      setRelinkOpen(null);
    } catch (err) {
      setRelinkError(err instanceof Error ? err.message : 'Failed to relink asset');
    }
  };

  return (
    <div className="assets-dock" data-testid="assets-dock">
      <div className="assets-dock-header">
        <div className="assets-dock-title">Assets</div>
        <button className="button button-compact" type="button" disabled={disabled} onClick={startImport} data-testid="assets-dock-import-button">
          + Import
        </button>
      </div>

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

      {importOpen && (
        <div className="assets-dock-import" data-testid="assets-dock-import-panel">
          <div className="assets-dock-import-row">
            <label className="field" style={{ flex: 1 }}>
              <span>Type</span>
              <select data-testid="assets-dock-import-kind-select" value={importKind} onChange={(e) => setImportKind(e.target.value as any)} disabled={disabled}>
                <option value="image">Image</option>
                <option value="spritesheet">Spritesheet</option>
                <option value="audio">Audio</option>
                <option value="font">Font</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Source</span>
              <select data-testid="assets-dock-import-source-select" value={sourceMode} onChange={(e) => setSourceMode(e.target.value as any)} disabled={disabled}>
                <option value="embedded">Embedded File</option>
                <option value="path">Asset Path</option>
              </select>
            </label>
            <button className="button button-compact" type="button" onClick={() => setImportOpen(false)} disabled={disabled}>
              ✕
            </button>
          </div>

          {sourceMode === 'embedded' ? (
            <>
              <input
                ref={fileInputRef}
                data-testid="assets-dock-file-input"
                type="file"
                style={{ display: 'none' }}
                accept={importKind === 'audio' ? 'audio/*' : importKind === 'font' ? '.ttf,.otf,.woff,.woff2' : 'image/*'}
                onChange={(e) => void onFilePicked(e)}
                disabled={disabled}
              />
              <button className="button" type="button" disabled={disabled} onClick={triggerFilePick} data-testid="assets-dock-pick-file">
                Choose file…
              </button>
              {(importKind === 'image' || importKind === 'spritesheet') && (
                <button
                  className="button"
                  type="button"
                  disabled={disabled}
                  onClick={() => setAdvancedImportOpen(true)}
                  data-testid="assets-dock-advanced-import"
                >
                  Advanced…
                </button>
              )}
              {fileError && <div className="muted">{fileError}</div>}
              {importKind === 'spritesheet' && loadedImage && (
                <div className="assets-dock-spritesheet-grid">
                  <div className="muted">{loadedImage.name} · {loadedImage.width}×{loadedImage.height}</div>
                  <div className="assets-dock-import-row">
                    <label className="field" style={{ flex: 1 }}>
                      <span>Frame W</span>
                      <input
                        data-testid="assets-dock-spritesheet-frame-width"
                        type="number"
                        value={frameWidth}
                        min={1}
                        disabled={disabled}
                        onChange={(e) => setFrameWidth(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Frame H</span>
                      <input
                        data-testid="assets-dock-spritesheet-frame-height"
                        type="number"
                        value={frameHeight}
                        min={1}
                        disabled={disabled}
                        onChange={(e) => setFrameHeight(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </label>
                    <button className="button" type="button" disabled={disabled} onClick={commitSpritesheetImport} data-testid="assets-dock-import-spritesheet">
                      Import
                    </button>
                  </div>
                </div>
              )}
              {importKind !== 'spritesheet' && (
                <div className="muted">Imported assets appear below immediately.</div>
              )}
            </>
          ) : (
            <div className="field">
              <span>Asset Path</span>
              <input
                data-testid="assets-dock-import-path-input"
                type="text"
                value={pathDraft}
                disabled={disabled}
                onChange={(e) => setPathDraft(e.target.value)}
                placeholder={importKind === 'audio' ? '/assets/audio/theme.mp3' : importKind === 'font' ? '/assets/fonts/MyFont.woff2' : '/assets/images/sprites.png'}
              />
              <button className="button" type="button" disabled={disabled} onClick={() => void commitPathImport()} data-testid="assets-dock-import-path">
                Import
              </button>
            </div>
          )}
        </div>
      )}

      <div className="assets-dock-list" role="list">
        {rows.length === 0 ? (
          <div className="muted">No assets.</div>
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
          const sourceBadge = asset?.source?.kind === 'embedded' ? 'Embedded' : asset?.source?.kind === 'path' ? 'Path' : '';

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
                <span className="assets-dock-label">{label}</span>
                <span className="assets-dock-badges">
                  {sourceBadge ? <span className="badge badge-inline">{sourceBadge}</span> : null}
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
                  setRowMenu({ assetKind, assetId, x: Math.min(rect.left, window.innerWidth - 240), y: rect.bottom + 6 });
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
          <button
            type="button"
            className="scene-graph-menu-item"
            role="menuitem"
            data-testid="assets-dock-row-menu-relink"
            onClick={() => {
              const next = rowMenu;
              setRowMenu(null);
              openRelink(next.assetKind, next.assetId);
            }}
          >
            Relink…
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

      {relinkOpen && (
        <div
          className="modal-overlay"
          data-testid="asset-relink-modal"
          role="dialog"
          aria-label="Relink asset"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRelinkOpen(null);
          }}
        >
          <div className="modal-card">
            <div className="panel-header">
              <p className="eyebrow">Assets</p>
              <h2 className="panel-title">Relink Asset</h2>
              <p className="panel-description">
                Relink keeps the same assetId so existing references remain intact.
              </p>
              <div className="muted" style={{ marginTop: 6 }}>
                Asset: <span className="mono">{relinkOpen.assetKind}:{relinkOpen.assetId}</span>
              </div>
            </div>

            <div className="panel-scroll" style={{ overflow: 'auto', paddingRight: 2 }}>
              <div className="field">
                <span>New source</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="radio" checked={relinkSourceMode === 'embedded'} onChange={() => setRelinkSourceMode('embedded')} />
                    Embedded file
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="radio" checked={relinkSourceMode === 'path'} onChange={() => setRelinkSourceMode('path')} />
                    Asset path
                  </label>
                </div>
              </div>

              {relinkSourceMode === 'path' ? (
                <div className="field">
                  <span>Asset Path</span>
                  <input
                    className="text-input"
                    data-testid="asset-relink-path-input"
                    type="text"
                    value={relinkPathDraft}
                    onChange={(e) => setRelinkPathDraft(e.target.value)}
                    placeholder="/assets/images/hero.png"
                  />
                </div>
              ) : (
                <div className="field">
                  <span>Embedded File</span>
                  <input
                    ref={relinkFileInputRef}
                    data-testid="asset-relink-file-input"
                    type="file"
                    accept={relinkOpen.assetKind === 'audio' ? 'audio/*' : relinkOpen.assetKind === 'font' ? '' : 'image/*'}
                  />
                </div>
              )}

              {relinkError && <div className="toolbar-error" role="alert">{relinkError}</div>}
            </div>

            <div className="toolbar-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="button" type="button" onClick={() => setRelinkOpen(null)} data-testid="asset-relink-cancel">
                Cancel
              </button>
              <button className="button" type="button" onClick={() => void applyRelink()} data-testid="asset-relink-apply">
                Relink
              </button>
            </div>
          </div>
        </div>
      )}

      {advancedImportOpen && (
        <div
          className="modal-overlay"
          data-testid="advanced-import-modal"
          role="dialog"
          aria-label="Advanced import"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAdvancedImportOpen(false);
          }}
        >
          <div className="modal-card">
            <div className="panel-header">
              <p className="eyebrow">Assets</p>
              <h2 className="panel-title">Advanced Import</h2>
              <p className="panel-description">
                Multi-frame sprite import with optional auto-hitbox (replaces SpriteImportPanel).
              </p>
            </div>
            <div className="panel-scroll" style={{ overflow: 'auto', paddingRight: 2 }}>
              <SpriteImportPanelView
                scene={project.scenes[sceneId]}
                selection={selection}
                dispatch={dispatch as any}
              />
            </div>
            <div className="toolbar-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="button" type="button" onClick={() => setAdvancedImportOpen(false)} data-testid="advanced-import-close">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
