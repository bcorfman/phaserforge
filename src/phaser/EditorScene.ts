import Phaser from 'phaser';
import { EventBus, setActiveScene } from './EventBus';
import { compileScene, CompiledScene } from '../compiler/compileScene';
import { SceneSpec, BoundsHitConditionSpec } from '../model/types';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';

export class EditorScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private boundsGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c0f1a');
    setActiveScene(this);
    EventBus.on('load-scene', this.loadScene, this);
    EventBus.emit('current-scene-ready', this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setActiveScene(null);
      EventBus.off('load-scene', this.loadScene, this);
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
    this.drawBoundsFromSpec(sceneSpec);
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

  private clearScene(): void {
    if (this.compiled) {
      this.compiled.reset();
    }
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    if (this.boundsGraphics) {
      this.boundsGraphics.destroy();
      this.boundsGraphics = undefined;
    }
  }
}
