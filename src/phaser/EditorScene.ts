import Phaser from 'phaser';
import { EventBus, setActiveScene } from './EventBus';
import { compileScene, CompiledScene } from '../compiler/compileScene';
import { SceneSpec, BoundsHitConditionSpec } from '../model/types';
import { Selection } from '../editor/EditorStore';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';

export class EditorScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private entityToGroup = new Map<string, string>();
  private boundsGraphics?: Phaser.GameObjects.Graphics;
  private groupFrames = new Map<string, Phaser.GameObjects.Graphics>();
  private groupLabels = new Map<string, Phaser.GameObjects.Text>();
  private selection: Selection = { kind: 'none' };

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c0f1a');
    setActiveScene(this);
    EventBus.on('load-scene', this.loadScene, this);
    EventBus.on('selection-changed', this.handleSelectionChanged, this);
    EventBus.emit('current-scene-ready', this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setActiveScene(null);
      EventBus.off('load-scene', this.loadScene, this);
      EventBus.off('selection-changed', this.handleSelectionChanged, this);
    });
  }

  update(_time: number, delta: number): void {
    if (!this.compiled) return;
    this.compiled.actionManager.update(delta);
    for (const entity of Object.values(this.compiled.entities)) {
      const sprite = this.sprites.get(entity.id);
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
    }
    this.updateGroupFrames();
  }

  private loadScene(sceneSpec: SceneSpec): void {
    this.clearScene();
    this.compiled = compileScene(sceneSpec, {
      callRegistry: {
        drop: (action, ctx) => {
          const dy = action.args?.dy ?? 0;
          if (!action.target) return;
          const target = resolveTarget(action.target, ctx.targets);
          const targets = flattenTarget(target);
          for (const t of targets) {
            t.y += dy;
          }
        },
      },
    });

    this.buildSprites();
    this.buildGroupFrames(sceneSpec);
    this.drawBoundsFromSpec(sceneSpec);
    this.applySelectionStyles();
    this.compiled.startAll();
  }

  private buildSprites(): void {
    if (!this.compiled) return;
    for (const entity of Object.values(this.compiled.entities)) {
      const rect = this.add.rectangle(entity.x, entity.y, entity.width, entity.height, 0x69d2ff, 0.9);
      rect.setStrokeStyle(2, 0x1a2b4a, 1);
      this.sprites.set(entity.id, rect);
    }
  }

  private buildGroupFrames(scene: SceneSpec): void {
    if (!this.compiled) return;

    for (const [groupId, group] of Object.entries(this.compiled.groups)) {
      group.members.forEach((member) => this.entityToGroup.set(member.id, groupId));

      const frame = this.add.graphics();
      const label = this.add.text(0, 0, scene.groups[groupId]?.name ?? groupId, {
        color: '#ffdf9d',
        fontFamily: 'IBM Plex Mono',
        fontSize: '11px',
      });
      label.setDepth(10);

      this.groupFrames.set(groupId, frame);
      this.groupLabels.set(groupId, label);
    }

    this.updateGroupFrames();
  }

  private updateGroupFrames(): void {
    if (!this.compiled) return;

    for (const [groupId, group] of Object.entries(this.compiled.groups)) {
      const frame = this.groupFrames.get(groupId);
      const label = this.groupLabels.get(groupId);
      if (!frame || !label) continue;

      const bounds = group.getBounds();
      const selected = this.selection.kind === 'group' && this.selection.id === groupId;
      frame.clear();
      frame.lineStyle(selected ? 3 : 2, selected ? 0xffb86b : 0x5aa9c8, selected ? 0.95 : 0.55);
      frame.strokeRoundedRect(
        bounds.minX - 10,
        bounds.minY - 10,
        bounds.maxX - bounds.minX + 20,
        bounds.maxY - bounds.minY + 20,
        10
      );

      label.setPosition(bounds.minX - 6, bounds.minY - 28);
      label.setAlpha(selected ? 1 : 0.75);
    }
  }

  private drawBoundsFromSpec(scene: SceneSpec): void {
    const boundsCondition = Object.values(scene.conditions).find(
      (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
    );
    if (!boundsCondition) return;
    const bounds = boundsCondition.bounds;
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x3b4f82, 1);
    graphics.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    this.boundsGraphics = graphics;
  }

  private handleSelectionChanged(selection: Selection): void {
    this.selection = selection;
    this.applySelectionStyles();
    this.updateGroupFrames();
  }

  private applySelectionStyles(): void {
    for (const [entityId, sprite] of this.sprites.entries()) {
      const groupId = this.entityToGroup.get(entityId);
      const selectedEntity = this.selection.kind === 'entity' && this.selection.id === entityId;
      const selectedGroup = this.selection.kind === 'group' && groupId === this.selection.id;
      const inGroup = Boolean(groupId);

      sprite.setAlpha(selectedEntity ? 1 : selectedGroup ? 0.95 : inGroup ? 0.72 : 0.9);
      sprite.setStrokeStyle(
        selectedEntity ? 3 : selectedGroup ? 3 : 2,
        selectedEntity ? 0xffb86b : selectedGroup ? 0x9fe7ff : 0x1a2b4a,
        1
      );
    }
  }

  private clearScene(): void {
    if (this.compiled) {
      this.compiled.reset();
    }
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.entityToGroup.clear();
    for (const frame of this.groupFrames.values()) {
      frame.destroy();
    }
    for (const label of this.groupLabels.values()) {
      label.destroy();
    }
    this.groupFrames.clear();
    this.groupLabels.clear();
    if (this.boundsGraphics) {
      this.boundsGraphics.destroy();
      this.boundsGraphics = undefined;
    }
  }
}
