import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EventBus, getActiveScene } from '../phaser/EventBus';
import { useEditorStore, type Selection } from './EditorStore';
import { hasDraggedAsset, readDraggedAsset } from './dragAssets';
import { getNextFormationName } from './behaviorCommands';
import { clampPopupToViewport, constrainPopupSizeToViewport, fitPopupWithinViewport, placePopupNearRect, type Size } from './popupPositioning';
import { CreateFormationDraftPanel } from './CreateFormationDraftPanel';
import {
  alignByBounds,
  alignSelectionToWorld,
  distributeCenters,
  getSelectionBounds,
  setSelectionCenter,
  snapPositions,
  spacingByCenters,
  type WorldRect
} from './layoutGeometry';
import { getSceneWorld } from './sceneWorld';

function getSelectedEntityIds(selection: Selection): string[] {
  if (selection.kind === 'entity') return [selection.id];
  if (selection.kind === 'entities') return selection.ids;
  return [];
}

export function CanvasOverlay({ gridSnapEnabled }: { gridSnapEnabled: boolean }) {
  const { state, dispatch } = useEditorStore();
  const scene = state.project.scenes[state.currentSceneId];
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [menuPopupSize, setMenuPopupSize] = useState<Size | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutPosition, setLayoutPosition] = useState<{ x: number; y: number } | null>(null);
  const [layoutPopupSize, setLayoutPopupSize] = useState<Size | null>(null);
  const layoutRootRef = useRef<HTMLDivElement | null>(null);
  const [layoutUnits, setLayoutUnits] = useState<'grid' | 'pixels'>('grid');
  const [layoutSpacingX, setLayoutSpacingX] = useState('1');
  const [layoutSpacingY, setLayoutSpacingY] = useState('1');
  const [layoutSetX, setLayoutSetX] = useState('');
  const [layoutSetY, setLayoutSetY] = useState('');
  const layoutActionButtonClassName = 'button button-compact';
  const [groupPromptOpen, setGroupPromptOpen] = useState(false);
  const [groupPromptPosition, setGroupPromptPosition] = useState<{ x: number; y: number } | null>(null);
  const [groupPromptPopupSize, setGroupPromptPopupSize] = useState<Size | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const groupPromptRootRef = useRef<HTMLDivElement | null>(null);
  const [dragAssetHint, setDragAssetHint] = useState<{ kind: 'replace'; entityId: string; x: number; y: number } | { kind: 'create'; x: number; y: number } | null>(null);
  const [draftPosition, setDraftPosition] = useState<{ x: number; y: number } | null>(null);
  const [draftDragOffset, setDraftDragOffset] = useState<{ x: number; y: number } | null>(null);
  const draftDragStateRef = useRef<{ startPointer: { x: number; y: number }; startOffset: { x: number; y: number } } | null>(null);
  const draftPopupSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const suppressSelectionCloseRef = useRef(false);
  const latestSelectionRef = useRef(state.selection);
  const latestModeRef = useRef(state.mode);
  const latestSceneIdRef = useRef(state.currentSceneId);

  useEffect(() => {
    latestSelectionRef.current = state.selection;
    latestModeRef.current = state.mode;
    latestSceneIdRef.current = state.currentSceneId;
  }, [state.selection, state.mode, state.currentSceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.code === 'Space') setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.code === 'Space') setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const selectedEntityIds = useMemo(() => getSelectedEntityIds(state.selection), [state.selection]);
  const selectedGroupId = state.selection.kind === 'group' ? state.selection.id : undefined;
  const multiSelectionIds = state.selection.kind === 'entities' ? state.selection.ids : [];
  const sceneWorld = getSceneWorld(scene);
  const hasEntitySelection = state.selection.kind === 'entity' || state.selection.kind === 'entities';
  const entityToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [groupId, group] of Object.entries(scene.groups)) {
      for (const entityId of group.members) {
        if (!map.has(entityId)) map.set(entityId, groupId);
      }
    }
    return map;
  }, [scene.groups]);

  const selectedGroupedIds = useMemo(
    () => selectedEntityIds.filter((id) => entityToGroupId.has(id)),
    [entityToGroupId, selectedEntityIds]
  );

  const canGroupSelection = state.mode === 'edit'
    && state.selection.kind === 'entities'
    && state.selection.ids.length >= 2
    && selectedGroupedIds.length === 0;
  const canAddToGroup = state.mode === 'edit' && selectedEntityIds.length > 0 && Object.keys(scene.groups).length > 0;
  const canUngroupSelection = state.mode === 'edit' && selectedGroupedIds.length > 0;
  const canDissolveGroup = state.mode === 'edit' && state.selection.kind === 'group';

  useEffect(() => {
    if (state.mode !== 'edit') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (latestModeRef.current !== 'edit') return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
      }

      const isGroupShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'g' || event.key === 'G');
      if (!isGroupShortcut) return;
      if (!canGroupSelection) return;
      event.preventDefault();

      const anchor = document.querySelector('[data-testid="canvas-group-button"]') as HTMLElement | null;
      if (anchor) {
        openGroupPromptNearElement(anchor);
        return;
      }
      setGroupNameDraft(getNextFormationName(scene));
      setGroupPromptPosition({ x: 16, y: 120 });
      setGroupPromptPopupSize(constrainPopupSizeToViewport({
        popupSize: { width: 320, height: 160 },
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
        padding: 12,
      }));
      setGroupPromptOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGroupSelection, scene, state.mode]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = menuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!layoutOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayoutOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const root = layoutRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setLayoutOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [layoutOpen]);

  useEffect(() => {
    if (suppressSelectionCloseRef.current) return;
    setMenuOpen(false);
  }, [state.selection.kind, selectedEntityIds.join(','), state.mode]);

  useEffect(() => {
    if (!state.formationDraft || state.mode !== 'edit') {
      setDraftPosition(null);
      setDraftDragOffset(null);
      return;
    }

    const measure = () => {
      const padding = 12;
      const fallbackSize = { width: 460, height: 520 };
      const measured = document.querySelector<HTMLElement>('[data-testid="create-formation-draft-panel"]')?.getBoundingClientRect();
      const popupSize = measured && measured.width > 0 && measured.height > 0
        ? { width: measured.width, height: measured.height }
        : (draftPopupSizeRef.current ?? fallbackSize);
      draftPopupSizeRef.current = popupSize;
      const { x, y } = placePopupNearRect({
        anchorRect: {
          left: 0,
          top: 0,
          right: window.innerWidth - padding,
          bottom: window.innerHeight - padding,
        },
        popupSize,
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
        padding,
        offset: 0,
        prefer: 'above',
        align: 'right',
      });
      const base = { x, y: y + 50 };
      const next = clampPopupToViewport({
        position: {
          x: base.x + (draftDragOffset?.x ?? 0),
          y: base.y + (draftDragOffset?.y ?? 0),
        },
        popupSize,
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
        padding,
      });
      setDraftPosition(next);
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [state.formationDraft, state.mode, draftDragOffset]);

  useEffect(() => {
    if (!state.formationDraft || state.mode !== 'edit') return;

    const handlePointerMove = (event: PointerEvent) => {
      const drag = draftDragStateRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startPointer.x;
      const dy = event.clientY - drag.startPointer.y;
      setDraftDragOffset({ x: drag.startOffset.x + dx, y: drag.startOffset.y + dy });
    };

    const handlePointerUp = () => {
      draftDragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [state.formationDraft, state.mode]);

  useEffect(() => {
    if (!groupPromptOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = groupPromptRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setGroupPromptOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGroupPromptOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [groupPromptOpen]);

  useEffect(() => {
    if (state.mode !== 'edit') return;
    const container = document.querySelector<HTMLDivElement>('#game-container');
    if (!container) return;

    const handleDragOver = (event: DragEvent) => {
      if (latestModeRef.current !== 'edit') return;
      if (!hasDraggedAsset(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';

      const activeScene = getActiveScene() as any;
      const hit = typeof activeScene?.hitTestAtClientPoint === 'function'
        ? activeScene.hitTestAtClientPoint(event.clientX, event.clientY)
        : { kind: 'none' as const };

      if (hit.kind === 'entity' && hit.id) {
        setDragAssetHint({ kind: 'replace', entityId: hit.id, x: event.clientX + 14, y: event.clientY + 14 });
      } else {
        setDragAssetHint({ kind: 'create', x: event.clientX + 14, y: event.clientY + 14 });
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (latestModeRef.current !== 'edit') return;
      const asset = readDraggedAsset(event.dataTransfer);
      if (!asset) return;
      if (asset.assetKind !== 'image' && asset.assetKind !== 'spritesheet') return;
      event.preventDefault();
      setDragAssetHint(null);

      const activeScene = getActiveScene() as any;
      const hit = typeof activeScene?.hitTestAtClientPoint === 'function'
        ? activeScene.hitTestAtClientPoint(event.clientX, event.clientY)
        : { kind: 'none' as const };

      if (hit.kind === 'entity' && hit.id) {
        dispatch({
          type: 'assign-asset-to-target',
          assetKind: asset.assetKind,
          assetId: asset.assetId,
          target: { kind: 'entity-sprite', sceneId: latestSceneIdRef.current, entityId: hit.id },
        } as any);
        dispatch({ type: 'select', selection: { kind: 'entity', id: hit.id } });
        return;
      }

      const canvas = activeScene?.game?.canvas as HTMLCanvasElement | undefined;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        dispatch({ type: 'create-entity-from-asset', assetKind: asset.assetKind, assetId: asset.assetId } as any);
        return;
      }

      const scale = activeScene?.scale;
      const camera = activeScene?.cameras?.main;
      if (!scale || !camera || typeof camera.getWorldPoint !== 'function') {
        dispatch({ type: 'create-entity-from-asset', assetKind: asset.assetKind, assetId: asset.assetId } as any);
        return;
      }

      const scaleX = scale.width / rect.width;
      const scaleY = scale.height / rect.height;
      const pointerX = (event.clientX - rect.left) * scaleX;
      const pointerY = (event.clientY - rect.top) * scaleY;
      const worldPoint = camera.getWorldPoint(pointerX, pointerY);

      dispatch({
        type: 'create-entity-from-asset',
        assetKind: asset.assetKind,
        assetId: asset.assetId,
        at: { x: worldPoint.x, y: worldPoint.y },
      } as any);
    };

    const handleDragLeave = () => setDragAssetHint(null);

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragleave', handleDragLeave);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('dragleave', handleDragLeave);
    };
  }, [dispatch, state.mode]);

  const selectionLabel = useMemo(() => {
    if (state.selection.kind === 'entities') return `${state.selection.ids.length} selected`;
    if (state.selection.kind === 'group') {
      const group = scene.groups[state.selection.id];
      if (!group) return 'Formation selected';
      return `Group: ${group.name ?? group.id}`;
    }
    return '';
  }, [scene.groups, state.selection]);

  const showSelectionBar = state.mode === 'edit' && (state.selection.kind === 'entities' || state.selection.kind === 'group');

  const openMenuNearElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const padding = 12;
    const viewportSize = { width: window.innerWidth, height: window.innerHeight };
    const constrainedSize = constrainPopupSizeToViewport({
      popupSize: { width: 320, height: 360 },
      viewportSize,
      padding,
    });
    const { x, y } = placePopupNearRect({
      anchorRect: rect,
      popupSize: constrainedSize,
      viewportSize,
      padding,
      offset: 10,
      prefer: 'below',
      align: 'right',
    });

    setMenuPosition({ x, y });
    setMenuPopupSize(constrainedSize);
    setMenuOpen(true);
  };

  const openLayoutNearElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const padding = 12;
    const viewportSize = { width: window.innerWidth, height: window.innerHeight };
    const constrainedSize = constrainPopupSizeToViewport({
      popupSize: { width: 360, height: 320 },
      viewportSize,
      padding,
    });
    const { x, y } = placePopupNearRect({
      anchorRect: rect,
      popupSize: constrainedSize,
      viewportSize,
      padding,
      offset: 10,
      prefer: 'below',
      align: 'right',
    });
    setLayoutPosition({ x, y });
    setLayoutPopupSize(constrainedSize);
    setLayoutOpen(true);
  };

  useEffect(() => {
    if (!layoutOpen) return;
    if (state.mode !== 'edit') return;
    if (state.selection.kind !== 'entities' || state.selection.ids.length < 2) return;
    const items = gatherLayoutItems(state.selection.ids);
    const bounds = getSelectionBounds(items);
    if (!bounds) return;
    setLayoutSetX(String(Math.round(bounds.centerX)));
    setLayoutSetY(String(Math.round(bounds.centerY)));
  }, [layoutOpen, state.mode, state.selection, state.currentSceneId]);

  useLayoutEffect(() => {
    if (!layoutOpen || !layoutPosition) return;

    const root = layoutRootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const fit = fitPopupWithinViewport({
      position: layoutPosition,
      popupSize: {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      },
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      padding: 12,
    });

    if (!layoutPopupSize || layoutPopupSize.width !== fit.popupSize.width || layoutPopupSize.height !== fit.popupSize.height) {
      setLayoutPopupSize(fit.popupSize);
    }

    if (layoutPosition.x !== fit.position.x || layoutPosition.y !== fit.position.y) {
      setLayoutPosition(fit.position);
    }
  }, [layoutOpen, layoutPosition, layoutPopupSize]);

  const applyLayoutPositions = (positions: Array<{ id: string; x: number; y: number }>) => {
    const final = gridSnapEnabled ? snapPositions(positions, 8) : positions;
    dispatch({ type: 'layout-entities', positions: final } as any);
  };

  const gatherLayoutItems = (ids: string[]): Array<{ id: string; x: number; y: number; rect: WorldRect }> => {
    const activeScene = getActiveScene() as any;
    const items: Array<{ id: string; x: number; y: number; rect: WorldRect }> = [];
    for (const id of ids) {
      const entity = scene.entities[id];
      if (!entity) continue;
      const rect = activeScene?.getEntityWorldRect?.(id) as any;
      if (!rect) continue;
      items.push({ id, x: entity.x, y: entity.y, rect });
    }
    return items;
  };

  const openGroupPromptNearElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const padding = 12;
    const viewportSize = { width: window.innerWidth, height: window.innerHeight };
    const constrainedSize = constrainPopupSizeToViewport({
      popupSize: { width: 320, height: 160 },
      viewportSize,
      padding,
    });
    const { x, y } = placePopupNearRect({
      anchorRect: rect,
      popupSize: constrainedSize,
      viewportSize,
      padding,
      offset: 10,
      prefer: 'above',
      align: 'left',
    });
    setGroupPromptPosition({ x, y });
    setGroupPromptPopupSize(constrainedSize);
    setGroupNameDraft(getNextFormationName(scene));
    setGroupPromptOpen(true);
  };

  const confirmCreateGroup = () => {
    if (!canGroupSelection) return;
    dispatch({ type: 'group-selection', name: groupNameDraft });
    setGroupPromptOpen(false);
  };

  return (
    <div className="canvas-overlay" data-testid="canvas-overlay">
      <div className="canvas-overlay-top-right" data-testid="canvas-overlay-top-right">
        <button
          aria-label="Undo"
          className="button"
          data-testid="undo-button"
          type="button"
          disabled={state.mode !== 'edit' || state.history.past.length === 0}
          onClick={() => dispatch({ type: 'history-undo' })}
        >
          Undo
        </button>
        <button
          aria-label="Redo"
          className="button"
          data-testid="redo-button"
          type="button"
          disabled={state.mode !== 'edit' || state.history.future.length === 0}
          onClick={() => dispatch({ type: 'history-redo' })}
        >
          Redo
        </button>
        <button
          aria-label="Toggle grid snapping"
          className={`button ${gridSnapEnabled ? 'active' : ''}`}
          data-testid="toggle-grid-snap-button"
          type="button"
          disabled={state.mode !== 'edit'}
          onClick={() => EventBus.emit('toggle-grid-snap')}
        >
          Snap: {gridSnapEnabled ? '8px' : 'Off'}
        </button>
        <button
          aria-label="Toggle play mode"
          className={`button ${state.mode === 'play' ? 'active' : ''}`}
          data-testid="toggle-mode-button"
          type="button"
          onClick={() => dispatch({ type: 'toggle-mode' })}
        >
          {state.mode === 'edit' ? 'Play Mode' : 'Edit Mode'}
        </button>
      </div>

      {spaceHeld && (
        <div className="space-pan-hint" data-testid="space-pan-hint">
          <div className="space-pan-hint-title">Pan mode: drag to move view</div>
          <div className="space-pan-hint-sub">Release Space to exit</div>
        </div>
      )}

      {dragAssetHint && (
        <div
          className="canvas-drag-hint"
          data-testid="canvas-drag-hint"
          style={{ left: dragAssetHint.x, top: dragAssetHint.y }}
        >
          <div className="canvas-drag-hint-title">
            {dragAssetHint.kind === 'replace' ? `Replace asset on “${dragAssetHint.entityId}”` : 'Create sprite from asset'}
          </div>
          <div className="canvas-drag-hint-sub">Drop to apply • Esc to cancel</div>
        </div>
      )}

      {showSelectionBar && (
        <div className="canvas-selection-bar" data-testid="canvas-selection-bar">
          <div className="canvas-selection-pill" data-testid="canvas-selection-label">{selectionLabel}</div>
          {state.selection.kind === 'group' && (
            <button
              aria-label="Edit formation members"
              className="button"
              data-testid="canvas-edit-members-button"
              type="button"
              onClick={() => selectedGroupId && dispatch({ type: 'ungroup-group', id: selectedGroupId })}
            >
              Edit members
            </button>
          )}
          {state.selection.kind === 'entities' && (
            <button
              aria-label="Group selection"
              className="button"
              data-testid="canvas-group-button"
              type="button"
              disabled={!canGroupSelection}
              onClick={(e) => openGroupPromptNearElement(e.currentTarget)}
            >
              Group…
            </button>
          )}
          {state.selection.kind === 'entities' && state.selection.ids.length >= 2 && (
            <button
              aria-label="Layout selection"
              className={`button ${layoutOpen ? 'active' : ''}`}
              data-testid="canvas-layout-button"
              type="button"
              onClick={(e) => {
                if (layoutOpen) {
                  setLayoutOpen(false);
                  return;
                }
                openLayoutNearElement(e.currentTarget);
              }}
            >
              Layout…
            </button>
          )}
          {state.selection.kind === 'group' && (
            <button
              aria-label="Dissolve formation"
              className="button"
              data-testid="canvas-dissolve-button"
              type="button"
              disabled={!canDissolveGroup}
              onClick={() => selectedGroupId && dispatch({ type: 'dissolve-group', id: selectedGroupId })}
            >
              Dissolve
            </button>
          )}
          {state.selection.kind === 'entities' && (
            <button
              aria-label="Remove sprites from formation"
              className="button"
              data-testid="canvas-ungroup-selection-button"
              type="button"
              disabled={!canUngroupSelection}
              onClick={() => dispatch({ type: 'remove-entities-from-groups', entityIds: selectedGroupedIds })}
            >
              Remove from formation
            </button>
          )}
          <button
            aria-label="Selection actions"
            className={`button button-compact ${menuOpen ? 'active' : ''}`}
            data-testid="canvas-selection-menu-button"
            type="button"
            onClick={(e) => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              openMenuNearElement(e.currentTarget);
            }}
          >
            …
          </button>
        </div>
      )}

      {layoutOpen && layoutPosition && state.mode === 'edit' && state.selection.kind === 'entities' && state.selection.ids.length >= 2 && (
        <div
          className="canvas-context-menu"
          data-testid="canvas-layout-popover"
          role="dialog"
          aria-label="Layout"
          ref={layoutRootRef}
          style={{
            left: layoutPosition.x,
            top: layoutPosition.y,
            width: layoutPopupSize?.width ?? 360,
            maxHeight: layoutPopupSize?.height,
            overflowY: layoutPopupSize ? 'auto' : undefined,
          }}
        >
          <div className="canvas-selection-menu-heading" style={{ marginBottom: 6 }}>Layout</div>

          <div className="canvas-selection-menu-section">
            <div className="canvas-selection-menu-heading">Arrange items</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <button className={layoutActionButtonClassName} data-testid="layout-distribute-x" type="button" onClick={() => applyLayoutPositions(distributeCenters(gatherLayoutItems(multiSelectionIds), 'x'))}>Distribute X</button>
              <button className={layoutActionButtonClassName} data-testid="layout-distribute-y" type="button" onClick={() => applyLayoutPositions(distributeCenters(gatherLayoutItems(multiSelectionIds), 'y'))}>Distribute Y</button>
            </div>

            <div className="canvas-selection-menu-heading" style={{ marginTop: 10 }}>Spacing</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button className={`button button-compact ${layoutUnits === 'grid' ? 'active' : ''}`} type="button" data-testid="layout-units-grid" onClick={() => setLayoutUnits('grid')}>Grid</button>
              <button className={`button button-compact ${layoutUnits === 'pixels' ? 'active' : ''}`} type="button" data-testid="layout-units-pixels" onClick={() => setLayoutUnits('pixels')}>Pixels</button>
            </div>
            <label className="field" style={{ margin: 0 }}>
              <span>Spacing X</span>
              <input className="text-input" data-testid="layout-spacing-x" type="number" value={layoutSpacingX} onChange={(e) => setLayoutSpacingX(e.target.value)} />
            </label>
            <button className={layoutActionButtonClassName} data-testid="layout-apply-spacing-x" type="button" onClick={() => {
              const raw = Number(layoutSpacingX);
              const spacing = layoutUnits === 'grid' ? raw * 8 : raw;
              applyLayoutPositions(spacingByCenters(gatherLayoutItems(multiSelectionIds), 'x', spacing));
            }}>Apply Spacing X</button>

            <label className="field" style={{ marginTop: 8 }}>
              <span>Spacing Y</span>
              <input className="text-input" data-testid="layout-spacing-y" type="number" value={layoutSpacingY} onChange={(e) => setLayoutSpacingY(e.target.value)} />
            </label>
            <button className={layoutActionButtonClassName} data-testid="layout-apply-spacing-y" type="button" onClick={() => {
              const raw = Number(layoutSpacingY);
              const spacing = layoutUnits === 'grid' ? raw * 8 : raw;
              applyLayoutPositions(spacingByCenters(gatherLayoutItems(multiSelectionIds), 'y', spacing));
            }}>Apply Spacing Y</button>
          </div>

          <div className="canvas-selection-menu-section">
            <div className="canvas-selection-menu-heading">Position selection</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <label className="field" style={{ margin: 0 }}>
                <span>X</span>
                <input className="text-input" data-testid="layout-set-x" type="number" value={layoutSetX} onChange={(e) => setLayoutSetX(e.target.value)} />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span>Y</span>
                <input className="text-input" data-testid="layout-set-y" type="number" value={layoutSetY} onChange={(e) => setLayoutSetY(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
              <button className={layoutActionButtonClassName} data-testid="layout-apply-set-x" type="button" onClick={() => {
                const x = Number(layoutSetX);
                applyLayoutPositions(setSelectionCenter(gatherLayoutItems(multiSelectionIds), { x }));
              }}>Set X</button>
              <button className={layoutActionButtonClassName} data-testid="layout-apply-set-y" type="button" onClick={() => {
                const y = Number(layoutSetY);
                applyLayoutPositions(setSelectionCenter(gatherLayoutItems(multiSelectionIds), { y }));
              }}>Set Y</button>
              <button className={layoutActionButtonClassName} data-testid="layout-apply-set-xy" type="button" onClick={() => {
                const x = Number(layoutSetX);
                const y = Number(layoutSetY);
                applyLayoutPositions(setSelectionCenter(gatherLayoutItems(multiSelectionIds), { x, y }));
              }}>Set X+Y</button>
            </div>

            <div className="canvas-selection-menu-heading" style={{ marginTop: 10 }}>Align selection</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <button className={layoutActionButtonClassName} data-testid="layout-align-left" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'left', sceneWorld.width, sceneWorld.height));
              }}>Left</button>
              <button className={layoutActionButtonClassName} data-testid="layout-align-center-x" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'centerX', sceneWorld.width, sceneWorld.height));
              }}>Center X</button>
              <button className={layoutActionButtonClassName} data-testid="layout-align-right" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'right', sceneWorld.width, sceneWorld.height));
              }}>Right</button>
              <button className={layoutActionButtonClassName} data-testid="layout-align-top" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'top', sceneWorld.width, sceneWorld.height));
              }}>Top</button>
              <button className={layoutActionButtonClassName} data-testid="layout-align-center-y" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'centerY', sceneWorld.width, sceneWorld.height));
              }}>Center Y</button>
              <button className={layoutActionButtonClassName} data-testid="layout-align-bottom" type="button" onClick={() => {
                applyLayoutPositions(alignSelectionToWorld(gatherLayoutItems(multiSelectionIds), 'bottom', sceneWorld.width, sceneWorld.height));
              }}>Bottom</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Center aligns to world center.</div>
          </div>

          <div className="canvas-selection-menu-section">
            <div className="canvas-selection-menu-heading">Advanced</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <button className={layoutActionButtonClassName} data-testid="layout-stack-center-x" type="button" onClick={() => {
                const ids = multiSelectionIds;
                applyLayoutPositions(alignByBounds(gatherLayoutItems(ids), 'centerX', ids[0]!));
              }}>Stack X centers</button>
              <button className={layoutActionButtonClassName} data-testid="layout-stack-center-y" type="button" onClick={() => {
                const ids = multiSelectionIds;
                applyLayoutPositions(alignByBounds(gatherLayoutItems(ids), 'centerY', ids[0]!));
              }}>Stack Y centers</button>
              <button className={layoutActionButtonClassName} data-testid="layout-match-left-edges" type="button" onClick={() => {
                const ids = multiSelectionIds;
                applyLayoutPositions(alignByBounds(gatherLayoutItems(ids), 'left', ids[0]!));
              }}>Match left edges</button>
              <button className={layoutActionButtonClassName} data-testid="layout-match-top-edges" type="button" onClick={() => {
                const ids = multiSelectionIds;
                applyLayoutPositions(alignByBounds(gatherLayoutItems(ids), 'top', ids[0]!));
              }}>Match top edges</button>
            </div>
          </div>

          <button className="button button-compact" type="button" data-testid="layout-close" onClick={() => setLayoutOpen(false)}>Close</button>
        </div>
      )}

      {state.mode === 'edit' && state.formationDraft && (
        <CreateFormationDraftPanel
          project={state.project}
          scene={scene}
          registry={state.registry}
          draft={state.formationDraft}
          dispatch={dispatch}
          popupClassName="canvas-context-menu--translucent"
          popupStyle={{
            left: draftPosition?.x ?? 12,
            top: draftPosition?.y ?? 12,
            width: '28rem',
            maxWidth: 'min(28rem, 92vw)',
            overflowX: 'hidden',
          }}
          onPopupPointerDown={(event) => {
            if (event.button !== 0) return;
            if (!(event.target instanceof Element)) return;
            if (!event.target.closest('.inspector-title')) return;
            if (!draftPosition) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            draftDragStateRef.current = {
              startPointer: { x: event.clientX, y: event.clientY },
              startOffset: draftDragOffset ?? { x: 0, y: 0 },
            };
          }}
        />
      )}

      {menuOpen && menuPosition && (
        <div
          className="canvas-context-menu"
          data-testid="canvas-context-menu"
          role="menu"
          aria-label="Selection actions"
          ref={menuRootRef}
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
            width: menuPopupSize?.width,
            maxHeight: menuPopupSize?.height,
            overflowY: menuPopupSize ? 'auto' : undefined,
          }}
        >
          {state.selection.kind === 'entities' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-create-group"
              type="button"
              role="menuitem"
              disabled={!canGroupSelection}
              onClick={() => {
                setMenuOpen(false);
                const anchor = document.querySelector('[data-testid="canvas-group-button"]') as HTMLElement | null;
                if (anchor) {
                  openGroupPromptNearElement(anchor);
                } else {
                  setGroupNameDraft(getNextFormationName(scene));
                  setGroupPromptPosition(menuPosition);
                  setGroupPromptPopupSize(constrainPopupSizeToViewport({
                    popupSize: { width: 320, height: 160 },
                    viewportSize: { width: window.innerWidth, height: window.innerHeight },
                    padding: 12,
                  }));
                  setGroupPromptOpen(true);
                }
              }}
            >
              Group…
            </button>
          )}

          {hasEntitySelection && (
            <div className="canvas-selection-menu-section" data-testid="canvas-menu-add-to-group-section">
              <div className="canvas-selection-menu-heading">Add to formation…</div>
              {Object.values(scene.groups).map((group) => (
                <button
                  key={group.id}
                  className="canvas-selection-menu-item"
                  data-testid={`canvas-menu-add-to-${group.id}`}
                  type="button"
                  role="menuitem"
                  disabled={!canAddToGroup}
                  onClick={() => {
                    dispatch({ type: 'add-entities-to-group', groupId: group.id, entityIds: selectedEntityIds });
                    setMenuOpen(false);
                  }}
                >
                  {group.name ?? group.id}
                </button>
              ))}
            </div>
          )}

          {hasEntitySelection && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-remove-from-group"
              type="button"
              role="menuitem"
              disabled={!canUngroupSelection}
              onClick={() => {
                dispatch({ type: 'remove-entities-from-groups', entityIds: selectedGroupedIds });
                setMenuOpen(false);
              }}
            >
              Remove from formation
            </button>
          )}

          {state.selection.kind === 'group' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-dissolve-group"
              type="button"
              role="menuitem"
              disabled={!canDissolveGroup}
              onClick={() => {
                if (selectedGroupId) dispatch({ type: 'dissolve-group', id: selectedGroupId });
                setMenuOpen(false);
              }}
            >
              Dissolve formation
            </button>
          )}

          {state.selection.kind === 'group' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-open-layout-inspector"
              type="button"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              Convert Layout (Inspector)…
            </button>
          )}
        </div>
      )}

      {groupPromptOpen && groupPromptPosition && (
        <div
          className="canvas-context-menu canvas-group-prompt"
          data-testid="canvas-group-prompt"
          role="dialog"
          aria-label="Group selection"
          ref={groupPromptRootRef}
          style={{
            left: groupPromptPosition.x,
            top: groupPromptPosition.y,
            maxWidth: groupPromptPopupSize?.width,
            maxHeight: groupPromptPopupSize?.height,
            overflowY: groupPromptPopupSize ? 'auto' : undefined,
          }}
        >
          <div className="canvas-selection-menu-heading" style={{ marginBottom: 4 }}>Group…</div>
          <label className="canvas-submenu-field" style={{ padding: 0 }}>
            <span>Name</span>
            <input
              autoFocus
              aria-label="Group name"
              data-testid="group-name-input"
              type="text"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmCreateGroup();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setGroupPromptOpen(false);
                }
              }}
            />
          </label>
          <div className="canvas-submenu-actions">
            <button className="button" type="button" onClick={() => setGroupPromptOpen(false)} data-testid="group-prompt-cancel">
              Cancel
            </button>
            <button className="button" type="button" disabled={!canGroupSelection} onClick={confirmCreateGroup} data-testid="group-prompt-confirm">
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
