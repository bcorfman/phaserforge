import { useEffect, useState, type ReactNode } from 'react';
import { useEditorStore } from './EditorStore';
import { summarizeGridLayout } from './grouping';
import { inferGroupGridLayout, type GroupGridLayout } from './formationLayout';
import { SpriteImportPanel } from './SpriteImportPanel';
import { AttachedActionsPanel } from './AttachedActionsPanel';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { AttachmentSpec, InlineBoundsHitConditionSpec, GroupSpec, SceneSpec, EntitySpec, type EditorRegistryConfig } from '../model/types';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { getNextFormationName } from './behaviorCommands';
import { getSceneWorld } from './sceneWorld';

export function Inspector() {
  const { state, dispatch } = useEditorStore();
  const { selection, scene, interaction } = state;
  const [pinDuringDrag, setPinDuringDrag] = useState(false);
  const [formationNameDraft, setFormationNameDraft] = useState('');

  const updateGroup = (next: GroupSpec) =>
    dispatch({ type: 'update-group', id: next.id, next });
  const updateEntity = (next: EntitySpec) =>
    dispatch({ type: 'update-entity', id: next.id, next });
  const arrangeGroupGrid = (id: string, layout: GroupGridLayout) =>
    dispatch({ type: 'arrange-group-grid', id, layout });
  const arrangeGroup = (id: string, arrangeKind: string, params: Record<string, number | string | boolean>) =>
    dispatch({ type: 'arrange-group', id, arrangeKind, params });

  useEffect(() => {
    if (selection.kind === 'entities') {
      setFormationNameDraft(getNextFormationName(scene));
    }
  }, [scene, selection]);

  let content: ReactNode = null;

  // Show drag information during interactions
  if (interaction && !pinDuringDrag) {
    if (interaction.kind === 'entity') {
      const entity = scene.entities[interaction.id];
      content = entity ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: {entity.name ?? entity.id}</div>
          <div className="inspector-row">Position: {Math.round(entity.x)}, {Math.round(entity.y)}</div>
          <div className="inspector-row">Size: {entity.width} x {entity.height}</div>
        </div>
      ) : null;
    } else if (interaction.kind === 'group') {
      const group = scene.groups[interaction.id];
      content = group ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: {group.name ?? group.id}</div>
          <div className="inspector-row">Members: {group.members.length}</div>
        </div>
      ) : null;
    } else if (interaction.kind === 'bounds') {
      const attachment = scene.attachments[interaction.id];
      const condition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
      content = condition ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: Bounds</div>
          <div className="inspector-row">Min: {condition.bounds.minX}, {condition.bounds.minY}</div>
          <div className="inspector-row">Max: {condition.bounds.maxX}, {condition.bounds.maxY}</div>
        </div>
      ) : null;
    }
  }

  // If no interaction content, show normal selection content
  if (!content) {
    if (selection.kind === 'attachment') {
      const attachment = scene.attachments[selection.id];
      content = attachment
        ? renderAttachmentInspector(
          attachment,
          scene,
          state.registry,
          (next) => dispatch({ type: 'update-attachment', id: next.id, next }),
          () => dispatch({ type: 'remove-attachment', id: attachment.id }),
        )
        : <div className="muted">Action not found.</div>;
    } else if (selection.kind === 'group') {
      const group = scene.groups[selection.id];
      content = group ? (
        <GroupInspector
          group={group}
          scene={scene}
          registry={state.registry}
          selectedAttachmentId={undefined}
          onAddAttachment={(presetId) => dispatch({ type: 'create-attachment', target: { type: 'group', groupId: group.id }, presetId })}
          onSelectAttachment={(id) => dispatch({ type: 'select', selection: { kind: 'attachment', id } })}
          onMoveAttachment={(id, direction) => dispatch({ type: 'move-attachment', id, direction })}
          onRemoveAttachment={(id) => dispatch({ type: 'remove-attachment', id })}
          onSelectMember={(id) => dispatch({ type: 'select', selection: { kind: 'entity', id } })}
          onRemoveMember={(entityId) => dispatch({ type: 'remove-entity-from-group', groupId: group.id, entityId })}
          onUpdateGroup={updateGroup}
          onArrangeGroup={arrangeGroup}
          onArrangeGroupGrid={arrangeGroupGrid}
        />
      ) : (
        <div className="muted">Formation not found.</div>
      );
    } else if (selection.kind === 'entity') {
      const entity = scene.entities[selection.id];
      content = entity ? (
        renderEntityInspector(entity, updateEntity, {
          scene,
          registry: state.registry,
          selectedAttachmentId: undefined,
          onAddAttachment: (presetId) => dispatch({ type: 'create-attachment', target: { type: 'entity', entityId: entity.id }, presetId }),
          onSelectAttachment: (id) => dispatch({ type: 'select', selection: { kind: 'attachment', id } }),
          onMoveAttachment: (id, direction) => dispatch({ type: 'move-attachment', id, direction }),
          onRemoveAttachment: (id) => dispatch({ type: 'remove-attachment', id }),
        })
      ) : (
        <div className="muted">Sprite not found.</div>
      );
    } else if (selection.kind === 'entities') {
      content = (
        <div className="inspector-block" data-testid="multi-entity-inspector">
          <div className="inspector-title">Selected Sprites</div>
          <div className="inspector-row">{selection.ids.length} sprites selected.</div>
          <div className="inspector-row">Create a freeform formation first, then arrange it into a grid if needed.</div>
          <label className="field">
            <span>Formation Name</span>
            <input
              aria-label="New Formation Name"
              data-testid="new-formation-name-input"
              type="text"
              value={formationNameDraft}
              onChange={(event) => setFormationNameDraft(event.target.value)}
            />
          </label>
          <button
            className="button"
            data-testid="create-formation-from-selection-button"
            type="button"
            onClick={() => dispatch({ type: 'create-group-from-selection', name: formationNameDraft })}
          >
            Create Formation from Selection
          </button>
        </div>
      );
    } else {
      content = <div className="muted">Select an item to edit.</div>;
    }
  }

  return (
    <div className="panel" data-testid="inspector">
      <div className="panel-header">
        <p className="eyebrow">Selection</p>
        <h2 className="panel-title">Inspector</h2>
        <p className="panel-description">
          Adjust authored values for the current selection and review the active scene registry.
        </p>
      </div>
      <label className="inspector-toggle">
        <input
          aria-label="Pin selection while dragging"
          data-testid="pin-selection-checkbox"
          type="checkbox"
          checked={pinDuringDrag}
          onChange={(e) => setPinDuringDrag(e.target.checked)}
        />
        <span>Pin selection while dragging</span>
      </label>
      {content}
      <RegistryPanel />
      <SpriteImportPanel />
    </div>
  );
}

export function renderEntityInspector(
  entity: EntitySpec,
  onUpdate: (next: EntitySpec) => void,
  actionProps?: {
    scene: SceneSpec;
    registry: EditorRegistryConfig;
    selectedAttachmentId?: string;
    onAddAttachment: (presetId: string) => void;
    onSelectAttachment: (id: string) => void;
    onMoveAttachment: (id: string, direction: 'up' | 'down') => void;
    onRemoveAttachment: (id: string) => void;
  }
) {
  return <EntityInspector entity={entity} onUpdate={onUpdate} actionProps={actionProps} />;
}

function EntityInspector({
  entity,
  onUpdate,
  actionProps,
}: {
  entity: EntitySpec;
  onUpdate: (next: EntitySpec) => void;
  actionProps?: {
    scene: SceneSpec;
    registry: EditorRegistryConfig;
    selectedAttachmentId?: string;
    onAddAttachment: (presetId: string) => void;
    onSelectAttachment: (id: string) => void;
    onMoveAttachment: (id: string, direction: 'up' | 'down') => void;
    onRemoveAttachment: (id: string) => void;
  };
}) {
  const resolved = resolveEntityDefaults(entity);
  const update = (patch: Partial<EntitySpec>) => onUpdate({ ...entity, ...patch });
  const foldouts = useInspectorFoldouts();

  return (
    <div className="inspector-block">
      <div className="inspector-title">{resolved.name ?? resolved.id}</div>
      <div className="inspector-row">Authored values update the selected sprite immediately on the canvas.</div>
      {actionProps && (
        <InspectorFoldout
          title="Actions"
          open={foldouts.isOpen('entity.actions', true)}
          onToggle={() => foldouts.toggle('entity.actions', true)}
        >
          <AttachedActionsPanel
            scene={actionProps.scene}
            target={{ type: 'entity', entityId: entity.id }}
            registry={actionProps.registry}
            onAddAttachment={actionProps.onAddAttachment}
            onSelectAttachment={actionProps.onSelectAttachment}
            onMoveAttachment={actionProps.onMoveAttachment}
            onRemoveAttachment={actionProps.onRemoveAttachment}
            selectedAttachmentId={actionProps.selectedAttachmentId}
          />
        </InspectorFoldout>
      )}
      <InspectorFoldout
        title="Transform"
        open={foldouts.isOpen('entity.transform', true)}
        onToggle={() => foldouts.toggle('entity.transform', true)}
      >
        <div className="inspector-grid-2">
          <label className="field">
            <span>X</span>
            <input aria-label="Entity X" data-testid="entity-x-input" type="number" value={resolved.x} onChange={(e) => update({ x: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Y</span>
            <input aria-label="Entity Y" data-testid="entity-y-input" type="number" value={resolved.y} onChange={(e) => update({ y: Number(e.target.value) })} />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Width</span>
            <input aria-label="Entity Width" data-testid="entity-width-input" type="number" min={1} value={resolved.width} onChange={(e) => update({ width: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <label className="field">
            <span>Height</span>
            <input aria-label="Entity Height" data-testid="entity-height-input" type="number" min={1} value={resolved.height} onChange={(e) => update({ height: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Scale X</span>
            <input aria-label="Scale X" data-testid="entity-scale-x-input" type="number" min={0.01} step="0.1" value={resolved.scaleX} onChange={(e) => update({ scaleX: Math.max(0.01, Number(e.target.value) || 0.01) })} />
          </label>
          <label className="field">
            <span>Scale Y</span>
            <input aria-label="Scale Y" data-testid="entity-scale-y-input" type="number" min={0.01} step="0.1" value={resolved.scaleY} onChange={(e) => update({ scaleY: Math.max(0.01, Number(e.target.value) || 0.01) })} />
          </label>
        </div>
        <label className="field">
          <span>Rotation</span>
          <input aria-label="Rotation" data-testid="entity-rotation-input" type="number" min={0} max={359} value={resolved.rotationDeg} onChange={(e) => update({ rotationDeg: Math.max(0, Math.min(359, Number(e.target.value) || 0)) })} />
        </label>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Origin X</span>
            <input aria-label="Origin X" data-testid="entity-origin-x-input" type="number" min={0} max={1} step="0.1" value={resolved.originX} onChange={(e) => update({ originX: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} />
          </label>
          <label className="field">
            <span>Origin Y</span>
            <input aria-label="Origin Y" data-testid="entity-origin-y-input" type="number" min={0} max={1} step="0.1" value={resolved.originY} onChange={(e) => update({ originY: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Flip X</span>
            <input aria-label="Flip X" data-testid="entity-flip-x-input" type="checkbox" checked={resolved.flipX} onChange={(e) => update({ flipX: e.target.checked })} />
          </label>
          <label className="field">
            <span>Flip Y</span>
            <input aria-label="Flip Y" data-testid="entity-flip-y-input" type="checkbox" checked={resolved.flipY} onChange={(e) => update({ flipY: e.target.checked })} />
          </label>
        </div>
      </InspectorFoldout>
      <InspectorFoldout
        title="Hitbox (Bounds)"
        open={foldouts.isOpen('entity.hitbox', true)}
        onToggle={() => foldouts.toggle('entity.hitbox', true)}
      >
        <label className="field">
          <span>Use Hitbox</span>
          <input
            aria-label="Use Hitbox"
            data-testid="entity-hitbox-enabled-input"
            type="checkbox"
            checked={Boolean(resolved.hitbox)}
            onChange={(e) => update({
              hitbox: e.target.checked
                ? { x: 0, y: 0, width: resolved.width, height: resolved.height }
                : undefined,
            })}
          />
        </label>
        <div className="inspector-row inspector-inline-buttons">
          <button
            className="button"
            data-testid="entity-hitbox-autofit-button"
            type="button"
            onClick={() => {
              void import('../phaser/EventBus').then(({ getActiveScene }) => {
                const scene = getActiveScene() as any;
                const computed = scene?.computeAutoHitboxForEntity?.(entity.id);
                if (computed) update({ hitbox: computed });
              }).catch(() => {});
            }}
          >
            Auto-fit
          </button>
          <button
            className="button"
            data-testid="entity-hitbox-reset-button"
            type="button"
            onClick={() => update({ hitbox: { x: 0, y: 0, width: resolved.width, height: resolved.height } })}
          >
            Reset
          </button>
        </div>
        {resolved.hitbox && (
          <>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Hitbox X</span>
                <input
                  aria-label="Hitbox X"
                  data-testid="entity-hitbox-x-input"
                  type="number"
                  min={0}
                  value={resolved.hitbox.x}
                  onChange={(e) =>
                    update({
                      hitbox: {
                        ...resolved.hitbox!,
                        x: Math.max(0, Math.min(resolved.width, Number(e.target.value) || 0)),
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Hitbox Y</span>
                <input
                  aria-label="Hitbox Y"
                  data-testid="entity-hitbox-y-input"
                  type="number"
                  min={0}
                  value={resolved.hitbox.y}
                  onChange={(e) =>
                    update({
                      hitbox: {
                        ...resolved.hitbox!,
                        y: Math.max(0, Math.min(resolved.height, Number(e.target.value) || 0)),
                      },
                    })
                  }
                />
              </label>
            </div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Hitbox Width</span>
                <input
                  aria-label="Hitbox Width"
                  data-testid="entity-hitbox-width-input"
                  type="number"
                  min={1}
                  value={resolved.hitbox.width}
                  onChange={(e) =>
                    update({
                      hitbox: {
                        ...resolved.hitbox!,
                        width: Math.max(1, Math.min(resolved.width - resolved.hitbox!.x, Number(e.target.value) || 1)),
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Hitbox Height</span>
                <input
                  aria-label="Hitbox Height"
                  data-testid="entity-hitbox-height-input"
                  type="number"
                  min={1}
                  value={resolved.hitbox.height}
                  onChange={(e) =>
                    update({
                      hitbox: {
                        ...resolved.hitbox!,
                        height: Math.max(1, Math.min(resolved.height - resolved.hitbox!.y, Number(e.target.value) || 1)),
                      },
                    })
                  }
                />
              </label>
            </div>
          </>
        )}
      </InspectorFoldout>
      <InspectorFoldout
        title="Visual"
        open={foldouts.isOpen('entity.visual', true)}
        onToggle={() => foldouts.toggle('entity.visual', true)}
      >
        <div className="inspector-grid-2">
          <label className="field">
            <span>Alpha</span>
            <input aria-label="Alpha" data-testid="entity-alpha-input" type="number" min={0} max={1} step="0.1" value={resolved.alpha} onChange={(e) => update({ alpha: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} />
          </label>
          <label className="field">
            <span>Visible</span>
            <input aria-label="Visible" data-testid="entity-visible-input" type="checkbox" checked={resolved.visible} onChange={(e) => update({ visible: e.target.checked })} />
          </label>
        </div>
        <label className="field">
          <span>Depth</span>
          <input aria-label="Depth" data-testid="entity-depth-input" type="number" value={resolved.depth} onChange={(e) => update({ depth: Number(e.target.value) || 0 })} />
        </label>
        <div className="inspector-row">
          Asset: {resolved.asset ? `${resolved.asset.imageType} (${resolved.asset.source.kind})` : 'Placeholder rectangle'}
        </div>
      </InspectorFoldout>
      {resolved.asset && (
        <InspectorFoldout
          title="Asset Details"
          open={foldouts.isOpen('entity.asset', false)}
          onToggle={() => foldouts.toggle('entity.asset', false)}
        >
          <div className="inspector-row">
            Source: {resolved.asset.source.kind === 'embedded' ? (resolved.asset.source.originalName ?? 'embedded') : resolved.asset.source.path}
          </div>
          {resolved.asset.imageType === 'spritesheet' ? (
            <>
              <label className="field">
                <span>Frame Index</span>
                <input
                  aria-label="Frame Index"
                  data-testid="entity-frame-index-input"
                  type="number"
                  min={0}
                  value={resolved.asset.frame?.frameIndex ?? ''}
                  onChange={(e) =>
                    update({
                      asset: {
                        ...resolved.asset!,
                        frame: {
                          ...(resolved.asset!.frame ?? { kind: 'spritesheet-frame' as const }),
                          kind: 'spritesheet-frame',
                          frameIndex: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Frame Key</span>
                <input
                  aria-label="Frame Key"
                  data-testid="entity-frame-key-input"
                  type="text"
                  value={resolved.asset.frame?.frameKey ?? ''}
                  onChange={(e) =>
                    update({
                      asset: {
                        ...resolved.asset!,
                        frame: {
                          ...(resolved.asset!.frame ?? { kind: 'spritesheet-frame' as const }),
                          kind: 'spritesheet-frame',
                          frameKey: e.target.value || undefined,
                        },
                      },
                    })
                  }
                />
              </label>
            </>
          ) : (
            <div className="inspector-row">Single image uses its only frame.</div>
          )}
        </InspectorFoldout>
      )}
    </div>
  );
}

function GroupInspector({
  group,
  scene,
  registry,
  selectedAttachmentId,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onSelectMember,
  onRemoveMember,
  onUpdateGroup,
  onArrangeGroup,
  onArrangeGroupGrid,
}: {
  group: GroupSpec;
  scene: SceneSpec;
  registry: EditorRegistryConfig;
  selectedAttachmentId?: string;
  onAddAttachment: (presetId: string) => void;
  onSelectAttachment: (id: string) => void;
  onMoveAttachment: (id: string, direction: 'up' | 'down') => void;
  onRemoveAttachment: (id: string) => void;
  onSelectMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
  onUpdateGroup: (next: GroupSpec) => void;
  onArrangeGroup: (id: string, arrangeKind: string, params: Record<string, number | string | boolean>) => void;
  onArrangeGroupGrid: (id: string, layout: GroupGridLayout) => void;
}) {
  const foldouts = useInspectorFoldouts();
  const arrangeEntries = registry.arrange.filter((entry) => entry.implemented);
  const inferredGrid = inferGroupGridLayout(scene, group.id);

  const deriveInitialArrangeKind = () => {
    if (group.layout?.type === 'grid') return 'grid';
    if (group.layout?.type === 'arrange') return group.layout.arrangeKind;
    return arrangeEntries[0]?.type ?? 'grid';
  };

  const deriveInitialParams = (kind: string) => {
    if (group.layout?.type === 'grid' && kind === 'grid') return group.layout as unknown as Record<string, number | string | boolean>;
    if (group.layout?.type === 'arrange' && kind === group.layout.arrangeKind) return group.layout.params;

    if (kind === 'grid' && inferredGrid) return inferredGrid as unknown as Record<string, number | string | boolean>;

    const entry = arrangeEntries.find((e) => e.type === kind);
    const params: Record<string, number | string | boolean> = {};
    for (const param of entry?.parameters ?? []) {
      if (typeof param.default !== 'undefined') {
        params[param.name] = param.default;
      } else if (param.type === 'number') {
        params[param.name] = 0;
      } else if (param.type === 'boolean') {
        params[param.name] = false;
      } else {
        params[param.name] = '';
      }
    }
    return params;
  };

  const [arrangeKindDraft, setArrangeKindDraft] = useState<string>(deriveInitialArrangeKind);
  const [arrangeParamsDraft, setArrangeParamsDraft] = useState<Record<string, number | string | boolean>>(
    deriveInitialParams(deriveInitialArrangeKind())
  );

  useEffect(() => {
    const kind = deriveInitialArrangeKind();
    setArrangeKindDraft(kind);
    setArrangeParamsDraft(deriveInitialParams(kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  return (
    renderGroupInspector(group, scene, arrangeKindDraft, arrangeParamsDraft, {
      registry,
      selectedAttachmentId,
      onAddAttachment,
      onSelectAttachment,
      onMoveAttachment,
      onRemoveAttachment,
      onSelectMember,
      onRemoveMember,
      onUpdateGroup,
      onArrangeGroup,
      onArrangeGroupGrid,
      onArrangeKindChange: (kind) => {
        setArrangeKindDraft(kind);
        setArrangeParamsDraft(deriveInitialParams(kind));
      },
      onArrangeParamsChange: (next) => setArrangeParamsDraft(next),
      foldouts,
    })
  );
}

export function renderGroupInspector(
  group: GroupSpec,
  scene: SceneSpec,
  arrangeKindDraft: string,
  arrangeParamsDraft: Record<string, number | string | boolean>,
  handlers: {
    registry: EditorRegistryConfig;
    selectedAttachmentId?: string;
    onAddAttachment: (presetId: string) => void;
    onSelectAttachment: (id: string) => void;
    onMoveAttachment: (id: string, direction: 'up' | 'down') => void;
    onRemoveAttachment: (id: string) => void;
    onSelectMember: (id: string) => void;
    onRemoveMember: (id: string) => void;
    onUpdateGroup: (next: GroupSpec) => void;
    onArrangeGroup: (id: string, arrangeKind: string, params: Record<string, number | string | boolean>) => void;
    onArrangeGroupGrid: (id: string, layout: GroupGridLayout) => void;
    onArrangeKindChange: (next: string) => void;
    onArrangeParamsChange: (next: Record<string, number | string | boolean>) => void;
    foldouts: { isOpen: (key: string, defaultOpen: boolean) => boolean; toggle: (key: string, defaultOpen: boolean) => void };
  }
) {
  const members = group.members.map((memberId) => scene.entities[memberId]).filter(Boolean);
  const layoutSummary = summarizeGridLayout(members);
  const arrangeEntries = handlers.registry.arrange.filter((entry) => entry.implemented);
  const selectedArrangeEntry = arrangeEntries.find((entry) => entry.type === arrangeKindDraft) ?? arrangeEntries[0];

  const formatParamLabel = (name: string) => {
    const withSpaces = name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/([0-9])([a-zA-Z])/g, '$1 $2');
    return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="inspector-block">
      <div className="inspector-title" data-testid="inspector-title">{group.name ?? group.id}</div>
      <InspectorFoldout
        title="Actions"
        open={handlers.foldouts.isOpen('group.actions', true)}
        onToggle={() => handlers.foldouts.toggle('group.actions', true)}
      >
        <AttachedActionsPanel
          scene={scene}
          target={{ type: 'group', groupId: group.id }}
          registry={handlers.registry}
          onAddAttachment={handlers.onAddAttachment}
          onSelectAttachment={handlers.onSelectAttachment}
          onMoveAttachment={handlers.onMoveAttachment}
          onRemoveAttachment={handlers.onRemoveAttachment}
          selectedAttachmentId={handlers.selectedAttachmentId}
        />
      </InspectorFoldout>

      <InspectorFoldout
        title="Formation"
        open={handlers.foldouts.isOpen('group.formation', true)}
        onToggle={() => handlers.foldouts.toggle('group.formation', true)}
      >
        <label className="field">
          <span>Formation Name</span>
          <input
            aria-label="Formation Name"
            data-testid="formation-name-input"
            type="text"
            value={group.name ?? ''}
            onChange={(e) => handlers.onUpdateGroup({ ...group, name: e.target.value })}
          />
        </label>
        <div className="inspector-row">Members: {group.members.length}</div>
        <div className="inspector-row">
          Layout: {layoutSummary.kind === 'grid' ? `${layoutSummary.rows} x ${layoutSummary.cols} grid` : 'Freeform'}
        </div>
      </InspectorFoldout>

      <InspectorFoldout
        title="Arrange"
        open={handlers.foldouts.isOpen('group.arrange', true)}
        onToggle={() => handlers.foldouts.toggle('group.arrange', true)}
      >
        <div className="inline-boundary-editor">
          <label className="field">
            <span>Preset</span>
            <select
              aria-label="Arrange Preset"
              data-testid="arrange-preset-select"
              value={arrangeKindDraft}
              onChange={(e) => handlers.onArrangeKindChange(e.target.value)}
            >
              {arrangeEntries.map((entry) => (
                <option key={entry.type} value={entry.type}>{entry.displayName}</option>
              ))}
            </select>
          </label>
          {(selectedArrangeEntry?.parameters ?? []).map((param) => {
            const rawValue = arrangeParamsDraft[param.name];
            const label = formatParamLabel(param.name);
            if (param.type === 'boolean') {
              return (
                <label key={param.name} className="field">
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    data-testid={`arrange-param-${param.name}`}
                    type="checkbox"
                    checked={Boolean(rawValue)}
                    onChange={(e) => handlers.onArrangeParamsChange({ ...arrangeParamsDraft, [param.name]: e.target.checked })}
                  />
                </label>
              );
            }
            if (param.type === 'number') {
              return (
                <label key={param.name} className="field">
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    data-testid={`arrange-param-${param.name}`}
                    type="number"
                    value={Number(rawValue ?? 0)}
                    onChange={(e) => handlers.onArrangeParamsChange({ ...arrangeParamsDraft, [param.name]: Number(e.target.value) })}
                  />
                </label>
              );
            }
            return (
              <label key={param.name} className="field">
                <span>{label}</span>
                <input
                  aria-label={label}
                  data-testid={`arrange-param-${param.name}`}
                  type="text"
                  value={String(rawValue ?? '')}
                  onChange={(e) => handlers.onArrangeParamsChange({ ...arrangeParamsDraft, [param.name]: e.target.value })}
                />
              </label>
            );
          })}
          {arrangeKindDraft === 'grid' && (
            <div className="inspector-row">
              Grid size will become {Math.max(1, Math.floor(Number(arrangeParamsDraft.rows ?? 1))) * Math.max(1, Math.floor(Number(arrangeParamsDraft.cols ?? 1)))} sprites.
            </div>
          )}
          <button
            className="button"
            data-testid="apply-group-layout-button"
            onClick={() => handlers.onArrangeGroup(group.id, arrangeKindDraft, arrangeParamsDraft)}
            type="button"
          >
            Apply Arrange Preset
          </button>
        </div>
      </InspectorFoldout>

      <InspectorFoldout
        title="Members"
        open={handlers.foldouts.isOpen('group.members', false)}
        onToggle={() => handlers.foldouts.toggle('group.members', false)}
      >
        <div className="inspector-row">Member sprites are read-only here. Select one only to inspect it.</div>
        <div className="member-list">
          {members.map((member) => (
            <div key={member.id} className="member-row">
              <button
                className="tag-button"
                data-testid={`group-member-select-${member.id}`}
                type="button"
                onClick={() => handlers.onSelectMember(member.id)}
              >
                {member.name ?? member.id}
              </button>
              <button
                className="tag-button tag-button-danger"
                data-testid={`group-member-remove-${member.id}`}
                type="button"
                onClick={() => handlers.onRemoveMember(member.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </InspectorFoldout>
    </div>
  );
}

export function renderAttachmentInspector(
  attachment: AttachmentSpec,
  scene: SceneSpec,
  registry: EditorRegistryConfig,
  onUpdate: (next: AttachmentSpec) => void,
  onRemove: () => void,
) {
  return (
    <AttachmentInspector
      attachment={attachment}
      scene={scene}
      registry={registry}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />
  );
}

function AttachmentInspector({
  attachment,
  scene,
  registry,
  onUpdate,
  onRemove,
}: {
  attachment: AttachmentSpec;
  scene: SceneSpec;
  registry: EditorRegistryConfig;
  onUpdate: (next: AttachmentSpec) => void;
  onRemove: () => void;
}) {
  const targetLabel =
    attachment.target.type === 'entity'
      ? (scene.entities[attachment.target.entityId]?.name ?? attachment.target.entityId)
      : (scene.groups[attachment.target.groupId]?.name ?? attachment.target.groupId);
  const supportedPresets = registry.actions.filter((entry) => entry.implemented && (entry.type === 'MoveUntil' || entry.type === 'Wait' || entry.type === 'Call' || entry.type === 'Repeat'));
  const params = attachment.params ?? {};
  const world = getSceneWorld(scene);
  const foldouts = useInspectorFoldouts();

  const ensureBoundsCondition = (): InlineBoundsHitConditionSpec => {
    if (attachment.condition?.type === 'BoundsHit') return attachment.condition;
    return {
      type: 'BoundsHit',
      bounds: { minX: 0, minY: 0, maxX: world.width, maxY: world.height },
      mode: 'any',
      scope: attachment.target.type === 'group' ? 'group-extents' : 'member-any',
      behavior: 'limit',
    };
  };

  return (
    <div className="inspector-block" data-testid="attachment-inspector">
      <div className="inspector-title">{attachment.name ?? attachment.id}</div>
      <div className="inspector-row">Attached to: {targetLabel}</div>
      <InspectorFoldout
        title="General"
        open={foldouts.isOpen('attachment.general', true)}
        onToggle={() => foldouts.toggle('attachment.general', true)}
      >
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Action Name"
            data-testid="attachment-name-input"
            type="text"
            value={attachment.name ?? ''}
            onChange={(e) => onUpdate({ ...attachment, name: e.target.value || undefined })}
          />
        </label>
        <label className="field">
          <span>Enabled</span>
          <input
            aria-label="Action Enabled"
            data-testid="attachment-enabled-input"
            type="checkbox"
            checked={attachment.enabled !== false}
            onChange={(e) => onUpdate({ ...attachment, enabled: e.target.checked })}
          />
        </label>
        {attachment.target.type === 'group' && (
          <label className="field">
            <span>Apply To</span>
            <select
              aria-label="Apply To"
              data-testid="attachment-apply-to-select"
              value={attachment.applyTo ?? 'group'}
              onChange={(e) => onUpdate({ ...attachment, applyTo: e.target.value === 'members' ? 'members' : 'group' })}
            >
              <option value="group">Group</option>
              <option value="members">Members</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>Type</span>
          <select
            aria-label="Action Type"
            data-testid="attachment-type-select"
            value={attachment.presetId}
            onChange={(e) => {
              const nextType = e.target.value;
              const base: AttachmentSpec = { ...attachment, presetId: nextType, params: {}, condition: undefined };
              if (nextType === 'MoveUntil') {
                onUpdate({ ...base, params: { velocityX: 0, velocityY: 0 }, condition: ensureBoundsCondition() });
                return;
              }
              if (nextType === 'Wait') {
                onUpdate({ ...base, params: { durationMs: 100 } });
                return;
              }
              if (nextType === 'Call') {
                onUpdate({ ...base, params: { callId: 'callback' } });
                return;
              }
              if (nextType === 'Repeat') {
                onUpdate({ ...base, params: {} });
                return;
              }
              onUpdate(base);
            }}
          >
            {supportedPresets.map((entry) => (
              <option key={entry.type} value={entry.type}>{entry.displayName}</option>
            ))}
          </select>
        </label>
      </InspectorFoldout>

      {attachment.presetId === 'MoveUntil' && (
        <InspectorFoldout
          title="Move Until"
          open={foldouts.isOpen('attachment.moveuntil', true)}
          onToggle={() => foldouts.toggle('attachment.moveuntil', true)}
        >
          <div className="inspector-grid-2">
            <label className="field">
              <span>Velocity X</span>
              <input
                aria-label="Velocity X"
                data-testid="attachment-velocity-x-input"
                type="number"
                value={Number(params.velocityX ?? 0)}
                onChange={(e) => onUpdate({ ...attachment, params: { ...params, velocityX: Number(e.target.value) } })}
              />
            </label>
            <label className="field">
              <span>Velocity Y</span>
              <input
                aria-label="Velocity Y"
                data-testid="attachment-velocity-y-input"
                type="number"
                value={Number(params.velocityY ?? 0)}
                onChange={(e) => onUpdate({ ...attachment, params: { ...params, velocityY: Number(e.target.value) } })}
              />
            </label>
          </div>
          <InspectorFoldout
            title="Bounds"
            open={foldouts.isOpen('attachment.bounds', true)}
            onToggle={() => foldouts.toggle('attachment.bounds', true)}
          >
            <button
              className="button"
              data-testid="attachment-add-bounds-condition"
              type="button"
              onClick={() => onUpdate({ ...attachment, condition: ensureBoundsCondition() })}
            >
              Ensure Bounds Condition
            </button>
            {attachment.condition?.type === 'BoundsHit' && (
              <>
                <label className="field">
                  <span>Behavior</span>
                  <select
                    aria-label="Behavior"
                    data-testid="attachment-bounds-behavior-select"
                    value={attachment.condition.behavior ?? 'limit'}
                    onChange={(e) => onUpdate({ ...attachment, condition: { ...attachment.condition!, behavior: e.target.value as any } })}
                  >
                    <option value="stop">Stop</option>
                    <option value="limit">Clamp at Edge</option>
                    <option value="bounce">Bounce</option>
                    <option value="wrap">Wrap</option>
                  </select>
                </label>
                <div className="inspector-grid-2">
                  <label className="field">
                    <span>Min X</span>
                    <input
                      aria-label="Bounds Min X"
                      data-testid="attachment-bounds-min-x-input"
                      type="number"
                      value={attachment.condition.bounds.minX}
                      onChange={(e) =>
                        onUpdate({ ...attachment, condition: { ...attachment.condition!, bounds: { ...attachment.condition!.bounds, minX: Number(e.target.value) } } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Min Y</span>
                    <input
                      aria-label="Bounds Min Y"
                      data-testid="attachment-bounds-min-y-input"
                      type="number"
                      value={attachment.condition.bounds.minY}
                      onChange={(e) =>
                        onUpdate({ ...attachment, condition: { ...attachment.condition!, bounds: { ...attachment.condition!.bounds, minY: Number(e.target.value) } } })
                      }
                    />
                  </label>
                </div>
                <div className="inspector-grid-2">
                  <label className="field">
                    <span>Max X</span>
                    <input
                      aria-label="Bounds Max X"
                      data-testid="attachment-bounds-max-x-input"
                      type="number"
                      value={attachment.condition.bounds.maxX}
                      onChange={(e) =>
                        onUpdate({ ...attachment, condition: { ...attachment.condition!, bounds: { ...attachment.condition!.bounds, maxX: Number(e.target.value) } } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Max Y</span>
                    <input
                      aria-label="Bounds Max Y"
                      data-testid="attachment-bounds-max-y-input"
                      type="number"
                      value={attachment.condition.bounds.maxY}
                      onChange={(e) =>
                        onUpdate({ ...attachment, condition: { ...attachment.condition!, bounds: { ...attachment.condition!.bounds, maxY: Number(e.target.value) } } })
                      }
                    />
                  </label>
                </div>
              </>
            )}
          </InspectorFoldout>
        </InspectorFoldout>
      )}

      {attachment.presetId === 'Wait' && (
        <InspectorFoldout
          title="Wait"
          open={foldouts.isOpen('attachment.wait', true)}
          onToggle={() => foldouts.toggle('attachment.wait', true)}
        >
          <label className="field">
            <span>Duration (ms)</span>
            <input
              aria-label="Duration Ms"
              data-testid="attachment-wait-duration-input"
              type="number"
              min={0}
              value={Number(params.durationMs ?? 0)}
              onChange={(e) => onUpdate({ ...attachment, params: { ...params, durationMs: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
        </InspectorFoldout>
      )}

      {attachment.presetId === 'Call' && (
        <InspectorFoldout
          title="Call"
          open={foldouts.isOpen('attachment.call', true)}
          onToggle={() => foldouts.toggle('attachment.call', true)}
        >
          <label className="field">
            <span>Call Id</span>
            <input
              aria-label="Call Id"
              data-testid="attachment-call-id-input"
              type="text"
              value={String(params.callId ?? '')}
              onChange={(e) => onUpdate({ ...attachment, params: { ...params, callId: e.target.value } })}
            />
          </label>
          <div className="inspector-grid-2">
            <label className="field">
              <span>dx</span>
              <input
                aria-label="dx"
                data-testid="attachment-call-dx-input"
                type="number"
                value={Number(params.dx ?? 0)}
                onChange={(e) => onUpdate({ ...attachment, params: { ...params, dx: Number(e.target.value) } })}
              />
            </label>
            <label className="field">
              <span>dy</span>
              <input
                aria-label="dy"
                data-testid="attachment-call-dy-input"
                type="number"
                value={Number(params.dy ?? 0)}
                onChange={(e) => onUpdate({ ...attachment, params: { ...params, dy: Number(e.target.value) } })}
              />
            </label>
          </div>
        </InspectorFoldout>
      )}

      {attachment.presetId === 'Repeat' && (
        <InspectorFoldout
          title="Repeat"
          open={foldouts.isOpen('attachment.repeat', true)}
          onToggle={() => foldouts.toggle('attachment.repeat', true)}
        >
          <div className="inspector-row">Wraps the rest of this target’s attached actions into a loop.</div>
          <label className="field">
            <span>Count</span>
            <input
              aria-label="Repeat Count"
              data-testid="attachment-repeat-count-input"
              type="number"
              min={0}
              value={typeof params.count === 'number' ? params.count : ''}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === '' ? undefined : Math.max(0, Number(raw) || 0);
                const nextParams = { ...params };
                if (next === undefined) {
                  delete (nextParams as any).count;
                } else {
                  (nextParams as any).count = next;
                }
                onUpdate({ ...attachment, params: nextParams });
              }}
            />
          </label>
        </InspectorFoldout>
      )}

      <button className="button button-danger" data-testid="attachment-delete-button" type="button" onClick={onRemove}>
        Delete Action
      </button>
    </div>
  );
}

function RegistryPanel() {
  const { state } = useEditorStore();

  return (
    <div className="inspector-block" data-testid="registry-panel">
      <div className="inspector-title">Available Types</div>
      <div className="inspector-row">Arrange</div>
      {state.registry.arrange.map((entry) => (
        <div key={`arrange-${entry.type}`} className="inspector-row">
          {entry.displayName}{entry.implemented ? '' : ' (planned)'}
        </div>
      ))}
      <div className="inspector-row">Actions</div>
      {state.registry.actions.map((entry) => (
        <div key={`action-${entry.type}`} className="inspector-row">
          {entry.displayName}{entry.implemented ? '' : ' (planned)'}
          {entry.propertyTargets?.length ? ` · ${entry.propertyTargets.map((target) => target.key).join(', ')}` : ''}
        </div>
      ))}
    </div>
  );
}
