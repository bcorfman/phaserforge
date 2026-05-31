import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { AssetFileSource, ProjectSpec } from '../model/types';
import type { EditorAction, Selection } from './EditorStore';
import { getAssetReferences, type AssetKind } from './assetReferences';
import { ASSET_DRAG_MIME } from './dragAssets';
import { loadImageMetadataFromFile, type LoadedImageMetadata } from './imageMetadata';

const DEMO_PACK_IMAGES = import.meta.glob('../../res/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

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

function assetIdBaseFromOriginalName(name: string | undefined, fallbackBase: string = 'asset'): string {
  const raw = (name ?? '').trim();
  const withoutExt = raw.replace(/\.[a-z0-9]+$/i, '');
  const base = withoutExt.length > 0 ? withoutExt : fallbackBase;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || fallbackBase;
}

async function readUrlAsDataUrl(url: string): Promise<{ dataUrl: string; mimeType?: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load demo pack asset (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], url.split('/').pop() ?? 'asset', { type: blob.type || undefined });
  return { dataUrl: await readAsDataUrl(file), ...(blob.type ? { mimeType: blob.type } : {}) };
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
  const [showImageThumbnails, setShowImageThumbnails] = useState(() => {
    const storage: any = (globalThis as any).localStorage;
    const raw = typeof storage?.getItem === 'function' ? storage.getItem('phaserforge.assetsDockShowThumbnails.v1') : null;
    if (raw === '0') return false;
    if (raw === '1') return true;
    return true;
  });
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const addMenuRootRef = useRef<HTMLDivElement | null>(null);
  const deviceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | undefined>();
  const [demoPackImporting, setDemoPackImporting] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ assetKind: AssetKind; assetId: string; x: number; y: number } | null>(null);
  const rowMenuRootRef = useRef<HTMLDivElement | null>(null);
  const [relinkOpen, setRelinkOpen] = useState<{ assetKind: AssetKind; assetId: string } | null>(null);
  const [relinkSourceMode, setRelinkSourceMode] = useState<'embedded' | 'path'>('path');
  const [relinkPathDraft, setRelinkPathDraft] = useState('');
  const [relinkError, setRelinkError] = useState<string | undefined>();
  const relinkFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storage: any = (globalThis as any).localStorage;
    if (typeof storage?.setItem === 'function') storage.setItem('phaserforge.assetsDockShowThumbnails.v1', showImageThumbnails ? '1' : '0');
  }, [showImageThumbnails]);

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
        const isFont = /\.(ttf|otf|woff|woff2)$/.test(lower);
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
      const urls = Object.entries(DEMO_PACK_IMAGES)
        .map(([path, url]) => ({ path, url }))
        .sort((a, b) => a.path.localeCompare(b.path));
      for (const { path, url } of urls) {
        const filename = path.split('/').pop() ?? 'image.png';
        const assetId = assetIdBaseFromOriginalName(filename, 'image');
        const { dataUrl, mimeType } = await readUrlAsDataUrl(url);
        const meta = toLoadedImage(await loadImageMetadataFromFile(new File([], filename), dataUrl));
        dispatch({
          type: 'ensure-image-asset-from-file',
          assetId,
          file: { dataUrl, originalName: filename, mimeType, width: meta.width, height: meta.height },
        } as any);
      }
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
          const sourceBadge = asset?.source?.kind === 'embedded' ? 'Embedded' : asset?.source?.kind === 'path' ? 'Path' : '';
          const thumbnailSrc = (assetKind === 'image' || assetKind === 'spritesheet') && asset?.source
            ? (asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path)
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

    </div>
  );
}
