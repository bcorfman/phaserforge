import { useEffect, useState, type ReactNode } from 'react';
import { useEditorStore } from './EditorStore';
import { summarizeGridLayout } from './grouping';
import { SpriteImportPanel } from './SpriteImportPanel';
import { AttachedActionsPanel } from './AttachedActionsPanel';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { AttachmentSpec, InlineBoundsHitConditionSpec, GroupSpec, SceneSpec, EntitySpec, type EditorRegistryConfig } from '../model/types';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { getNextFormationName } from './behaviorCommands';
import { getSceneWorld } from './sceneWorld';
import { ValidatedNumberInput, ValidatedOptionalNumberInput } from './ValidatedNumberInput';
import { CreateFormationPanel } from './CreateFormationPanel';
import { BackgroundLayersPanel } from './BackgroundLayersPanel';

export function Inspector() {
  const { state, dispatch } = useEditorStore();
  const scene = state.project.scenes[state.currentSceneId];
  const { selection, interaction } = state;
  const [pinDuringDrag, setPinDuringDrag] = useState(false);
  const [formationNameDraft, setFormationNameDraft] = useState('');

  const updateGroup = (next: GroupSpec) =>
    dispatch({ type: 'update-group', id: next.id, next });
  const updateEntity = (next: EntitySpec) =>
    dispatch({ type: 'update-entity', id: next.id, next });

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
    } else if (interaction.kind === 'entities') {
      const ids = interaction.id.split(',').filter(Boolean);
      const count = ids.length;
      content = (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: Multi-select</div>
          <div className="inspector-row">{count} sprites</div>
          <div className="inspector-row">Use Arrow keys to nudge • Shift + Arrow = 10px</div>
        </div>
      );
    } else if (interaction.kind === 'group') {
      const group = scene.groups[interaction.id];
      content = group ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: {group.name ?? group.id}</div>
          <div className="inspector-row">Members: {group.members.length}</div>
          <div className="inspector-row">Tip: Tab toggles Edit/Preview</div>
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
          onUngroup={() => dispatch({ type: 'ungroup-group', id: group.id })}
          onDissolve={() => dispatch({ type: 'dissolve-group', id: group.id })}
          onDeleteGroup={() => dispatch({ type: 'delete-group', id: group.id })}
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
          <div className="inspector-row">Group these sprites to get a single formation bounding box.</div>
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
            data-testid="group-selection-button"
            type="button"
            onClick={() => dispatch({ type: 'group-selection', name: formationNameDraft })}
          >
            Group
          </button>
        </div>
      );
    } else {
      content = (
        <>
          <BackgroundLayersPanel
            project={state.project}
            sceneId={state.currentSceneId}
            layers={scene.backgroundLayers ?? []}
            dispatch={dispatch}
            disabled={state.mode !== 'edit'}
          />
          <CreateFormationPanel scene={scene} registry={state.registry} dispatch={dispatch} />
        </>
      );
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
            <ValidatedNumberInput
              aria-label="Entity X"
              data-testid="entity-x-input"
              value={resolved.x}
              onCommit={(next) => update({ x: next })}
            />
          </label>
          <label className="field">
            <span>Y</span>
            <ValidatedNumberInput
              aria-label="Entity Y"
              data-testid="entity-y-input"
              value={resolved.y}
              onCommit={(next) => update({ y: next })}
            />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Width</span>
            <ValidatedNumberInput
              aria-label="Entity Width"
              data-testid="entity-width-input"
              min={1}
              value={resolved.width}
              clamp={(next) => Math.max(1, next || 1)}
              onCommit={(next) => update({ width: next })}
            />
          </label>
          <label className="field">
            <span>Height</span>
            <ValidatedNumberInput
              aria-label="Entity Height"
              data-testid="entity-height-input"
              min={1}
              value={resolved.height}
              clamp={(next) => Math.max(1, next || 1)}
              onCommit={(next) => update({ height: next })}
            />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Scale X</span>
            <ValidatedNumberInput
              aria-label="Scale X"
              data-testid="entity-scale-x-input"
              min={0.01}
              step="0.1"
              value={resolved.scaleX}
              clamp={(next) => Math.max(0.01, next || 0.01)}
              onCommit={(next) => update({ scaleX: next })}
            />
          </label>
          <label className="field">
            <span>Scale Y</span>
            <ValidatedNumberInput
              aria-label="Scale Y"
              data-testid="entity-scale-y-input"
              min={0.01}
              step="0.1"
              value={resolved.scaleY}
              clamp={(next) => Math.max(0.01, next || 0.01)}
              onCommit={(next) => update({ scaleY: next })}
            />
          </label>
        </div>
        <label className="field">
          <span>Rotation</span>
          <ValidatedNumberInput
            aria-label="Rotation"
            data-testid="entity-rotation-input"
            min={0}
            max={359}
            value={resolved.rotationDeg}
            clamp={(next) => Math.max(0, Math.min(359, next || 0))}
            onCommit={(next) => update({ rotationDeg: next })}
          />
        </label>
        <div className="inspector-grid-2">
          <label className="field">
            <span>Origin X</span>
            <ValidatedNumberInput
              aria-label="Origin X"
              data-testid="entity-origin-x-input"
              min={0}
              max={1}
              step="0.1"
              value={resolved.originX}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => update({ originX: next })}
            />
          </label>
          <label className="field">
            <span>Origin Y</span>
            <ValidatedNumberInput
              aria-label="Origin Y"
              data-testid="entity-origin-y-input"
              min={0}
              max={1}
              step="0.1"
              value={resolved.originY}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => update({ originY: next })}
            />
          </label>
        </div>
        <div className="inspector-grid-2">
          <label className="field field-checkbox">
            <span>Flip X</span>
            <input aria-label="Flip X" data-testid="entity-flip-x-input" type="checkbox" checked={resolved.flipX} onChange={(e) => update({ flipX: e.target.checked })} />
          </label>
          <label className="field field-checkbox">
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
	                <ValidatedNumberInput
	                  aria-label="Hitbox X"
	                  data-testid="entity-hitbox-x-input"
	                  min={0}
	                  value={resolved.hitbox.x}
	                  clamp={(next) => Math.max(0, Math.min(resolved.width, next || 0))}
	                  onCommit={(next) => update({ hitbox: { ...resolved.hitbox!, x: next } })}
	                />
	              </label>
              <label className="field">
                <span>Hitbox Y</span>
                <ValidatedNumberInput
                  aria-label="Hitbox Y"
                  data-testid="entity-hitbox-y-input"
                  min={0}
                  value={resolved.hitbox.y}
                  clamp={(next) => Math.max(0, Math.min(resolved.height, next || 0))}
                  onCommit={(next) => update({ hitbox: { ...resolved.hitbox!, y: next } })}
                />
              </label>
            </div>
            <div className="inspector-grid-2">
              <label className="field">
                <span>Hitbox Width</span>
                <ValidatedNumberInput
                  aria-label="Hitbox Width"
                  data-testid="entity-hitbox-width-input"
                  min={1}
                  value={resolved.hitbox.width}
                  clamp={(next) => Math.max(1, Math.min(resolved.width - resolved.hitbox!.x, next || 1))}
                  onCommit={(next) => update({ hitbox: { ...resolved.hitbox!, width: next } })}
                />
              </label>
              <label className="field">
                <span>Hitbox Height</span>
                <ValidatedNumberInput
                  aria-label="Hitbox Height"
                  data-testid="entity-hitbox-height-input"
                  min={1}
                  value={resolved.hitbox.height}
                  clamp={(next) => Math.max(1, Math.min(resolved.height - resolved.hitbox!.y, next || 1))}
                  onCommit={(next) => update({ hitbox: { ...resolved.hitbox!, height: next } })}
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
            <ValidatedNumberInput
              aria-label="Alpha"
              data-testid="entity-alpha-input"
              min={0}
              max={1}
              step="0.1"
              value={resolved.alpha}
              clamp={(next) => Math.max(0, Math.min(1, next || 0))}
              onCommit={(next) => update({ alpha: next })}
            />
          </label>
          <label className="field">
            <span>Visible</span>
            <input aria-label="Visible" data-testid="entity-visible-input" type="checkbox" checked={resolved.visible} onChange={(e) => update({ visible: e.target.checked })} />
          </label>
        </div>
        <label className="field">
          <span>Depth</span>
          <ValidatedNumberInput
            aria-label="Depth"
            data-testid="entity-depth-input"
            value={resolved.depth}
            onCommit={(next) => update({ depth: next })}
          />
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
	                <ValidatedOptionalNumberInput
	                  aria-label="Frame Index"
	                  data-testid="entity-frame-index-input"
	                  min={0}
	                  value={resolved.asset.frame?.frameIndex}
	                  clamp={(next) => Math.max(0, next || 0)}
	                  onCommit={(next) =>
	                    update({
	                      asset: {
	                        ...resolved.asset!,
	                        frame: {
	                          ...(resolved.asset!.frame ?? { kind: 'spritesheet-frame' as const }),
	                          kind: 'spritesheet-frame',
	                          frameIndex: next,
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
  onUngroup,
  onDissolve,
  onDeleteGroup,
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
  onUngroup: () => void;
  onDissolve: () => void;
  onDeleteGroup: () => void;
}) {
  const foldouts = useInspectorFoldouts();

  return (
    renderGroupInspector(group, scene, {
      registry,
      selectedAttachmentId,
      onAddAttachment,
      onSelectAttachment,
      onMoveAttachment,
      onRemoveAttachment,
      onSelectMember,
      onRemoveMember,
      onUpdateGroup,
      onUngroup,
      onDissolve,
      onDeleteGroup,
      foldouts,
    })
  );
}

export function renderGroupInspector(
  group: GroupSpec,
  scene: SceneSpec,
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
    onUngroup: () => void;
    onDissolve: () => void;
    onDeleteGroup: () => void;
    foldouts: { isOpen: (key: string, defaultOpen: boolean) => boolean; toggle: (key: string, defaultOpen: boolean) => void };
  }
) {
  const members = group.members.map((memberId) => scene.entities[memberId]).filter(Boolean);
  const layoutSummary = summarizeGridLayout(members);

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
        title="Grouping"
        open={handlers.foldouts.isOpen('group.grouping', true)}
        onToggle={() => handlers.foldouts.toggle('group.grouping', true)}
      >
        <div className="inspector-row">Toggle between a single formation selection and its individual member sprites.</div>
        <div className="inspector-row">
          <button
            className="button"
            data-testid="ungroup-button"
            type="button"
            onClick={handlers.onUngroup}
          >
            Ungroup
          </button>
          <button
            className="button"
            data-testid="dissolve-group-button"
            type="button"
            onClick={handlers.onDissolve}
          >
            Dissolve Group
          </button>
          <button
            className="button button-danger"
            data-testid="delete-group-button"
            type="button"
            onClick={handlers.onDeleteGroup}
          >
            Delete Group
          </button>
        </div>
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

  const boundsCondition = attachment.condition?.type === 'BoundsHit' ? attachment.condition : undefined;

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
	              <ValidatedNumberInput
	                aria-label="Velocity X"
	                data-testid="attachment-velocity-x-input"
	                value={Number(params.velocityX ?? 0)}
	                onCommit={(next) => onUpdate({ ...attachment, params: { ...params, velocityX: next } })}
	              />
	            </label>
	            <label className="field">
	              <span>Velocity Y</span>
	              <ValidatedNumberInput
	                aria-label="Velocity Y"
	                data-testid="attachment-velocity-y-input"
	                value={Number(params.velocityY ?? 0)}
	                onCommit={(next) => onUpdate({ ...attachment, params: { ...params, velocityY: next } })}
	              />
	            </label>
	          </div>
	          <InspectorFoldout
	            title="Bounds"
	            open={foldouts.isOpen('attachment.bounds', true)}
	            onToggle={() => foldouts.toggle('attachment.bounds', true)}
	          >
	            <label className="field">
	              <span>Enabled</span>
	              <input
	                aria-label="Enabled"
	                data-testid="attachment-bounds-enabled-input"
	                type="checkbox"
                checked={Boolean(boundsCondition)}
                onChange={(e) =>
                  onUpdate({ ...attachment, condition: e.target.checked ? ensureBoundsCondition() : undefined })
                }
              />
            </label>
            {boundsCondition && (
              <>
                <label className="field">
                  <span>Behavior</span>
                  <select
                    aria-label="Behavior"
                    data-testid="attachment-bounds-behavior-select"
                    value={boundsCondition.behavior ?? 'limit'}
                    onChange={(e) => onUpdate({ ...attachment, condition: { ...boundsCondition, behavior: e.target.value as any } })}
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
                    <ValidatedNumberInput
                      aria-label="Bounds Min X"
                      data-testid="attachment-bounds-min-x-input"
                      value={boundsCondition.bounds.minX}
                      onCommit={(next) =>
                        onUpdate({ ...attachment, condition: { ...boundsCondition, bounds: { ...boundsCondition.bounds, minX: next } } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Min Y</span>
                    <ValidatedNumberInput
                      aria-label="Bounds Min Y"
                      data-testid="attachment-bounds-min-y-input"
                      value={boundsCondition.bounds.minY}
                      onCommit={(next) =>
                        onUpdate({ ...attachment, condition: { ...boundsCondition, bounds: { ...boundsCondition.bounds, minY: next } } })
                      }
                    />
                  </label>
                </div>
                <div className="inspector-grid-2">
                  <label className="field">
                    <span>Max X</span>
                    <ValidatedNumberInput
                      aria-label="Bounds Max X"
                      data-testid="attachment-bounds-max-x-input"
                      value={boundsCondition.bounds.maxX}
                      onCommit={(next) =>
                        onUpdate({ ...attachment, condition: { ...boundsCondition, bounds: { ...boundsCondition.bounds, maxX: next } } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Max Y</span>
                    <ValidatedNumberInput
                      aria-label="Bounds Max Y"
                      data-testid="attachment-bounds-max-y-input"
                      value={boundsCondition.bounds.maxY}
                      onCommit={(next) =>
                        onUpdate({ ...attachment, condition: { ...boundsCondition, bounds: { ...boundsCondition.bounds, maxY: next } } })
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
	            <ValidatedNumberInput
	              aria-label="Duration Ms"
	              data-testid="attachment-wait-duration-input"
	              min={0}
	              value={Number(params.durationMs ?? 0)}
	              clamp={(next) => Math.max(0, next || 0)}
	              onCommit={(next) => onUpdate({ ...attachment, params: { ...params, durationMs: next } })}
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
	              <ValidatedNumberInput
	                aria-label="dx"
	                data-testid="attachment-call-dx-input"
	                value={Number(params.dx ?? 0)}
	                onCommit={(next) => onUpdate({ ...attachment, params: { ...params, dx: next } })}
	              />
	            </label>
	            <label className="field">
	              <span>dy</span>
	              <ValidatedNumberInput
	                aria-label="dy"
	                data-testid="attachment-call-dy-input"
	                value={Number(params.dy ?? 0)}
	                onCommit={(next) => onUpdate({ ...attachment, params: { ...params, dy: next } })}
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
	            <ValidatedOptionalNumberInput
	              aria-label="Repeat Count"
	              data-testid="attachment-repeat-count-input"
	              min={0}
	              value={typeof params.count === 'number' ? params.count : undefined}
	              clamp={(next) => Math.max(0, next || 0)}
	              onCommit={(next) => {
	                const nextParams = { ...params } as any;
	                if (next === undefined) {
	                  delete nextParams.count;
	                } else {
	                  nextParams.count = next;
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
