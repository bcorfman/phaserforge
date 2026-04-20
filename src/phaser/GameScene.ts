import Phaser from 'phaser';
import { EventBus, setActiveScene } from './EventBus';
import { compileScene, type CompiledScene } from '../compiler/compileScene';
import type { SceneSpec, SpriteAssetSpec, type HitboxSpec } from '../model/types';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';
import { getRotatedEntityBounds } from '../runtime/geometry';
import { computeAabbBounds } from '../runtime/geometry/aabbBounds';
import { registerSceneGetter, unregisterSceneGetter } from '../testing/testBridge';

const PLACEHOLDER_TEXTURE_KEY = '__phaseractions-studio:placeholder-1x1';

type PhysicsObject =
  | Phaser.Types.Physics.Arcade.ImageWithDynamicBody
  | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export class GameScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private formationPhysicsGroups = new Map<string, Phaser.Physics.Arcade.Group>();
  private physicsObjects = new Map<string, PhysicsObject>();
  private physicsVelocityCache = new Map<string, { vx: number; vy: number }>();
  private physicsSizeCache = new Map<string, { w: number; h: number }>();
  private loadVersion = 0;
  private readonly sceneBridgeGetter = () => this;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.roundPixels = true;
    setActiveScene(this);
    registerSceneGetter(this.sceneBridgeGetter);
    EventBus.emit('current-scene-ready', this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setActiveScene(null);
      unregisterSceneGetter(this.sceneBridgeGetter);
      this.clearScene();
    });
  }

  public loadSceneSpec(sceneSpec: SceneSpec): void {
    const currentLoadVersion = ++this.loadVersion;
    this.clearScene();
    this.compiled = compileScene(sceneSpec, {
      callRegistry: {
        drop: (action, ctx) => {
          const dy = (action as any).args?.dy ?? 0;
          if (!(action as any).target) return;
          const target = resolveTarget((action as any).target, ctx.targets);
          const targets = flattenTarget(target);
          for (const t of targets) {
            t.y += dy;
          }
        },
      },
    });

    void this.ensureAssetTextures(sceneSpec).finally(() => {
      if (currentLoadVersion !== this.loadVersion || !this.compiled) return;
      this.buildSprites();
      this.buildFormationPhysicsGroups(sceneSpec);
      this.compiled.startAll();
    });
  }

  public getTestSnapshot(): {
    ready: boolean;
    sceneKey: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  } {
    return {
      ready: Boolean(this.compiled),
      sceneKey: this.scene.key,
      zoom: this.cameras.main.zoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      viewportWidth: this.scale.width,
      viewportHeight: this.scale.height,
    };
  }

  public getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null {
    const group = this.formationPhysicsGroups.get(groupId);
    if (!group) return null;
    return { memberCount: group.getChildren().length };
  }

  public getEntityWorldRect(id: string): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
    const entity = this.compiled?.entities[id];
    if (!entity) return null;
    const bounds = getRotatedEntityBounds(entity);
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      centerX: entity.x,
      centerY: entity.y,
    };
  }

  public getEntitySpriteWorldRect(id: string): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
    const sprite = this.sprites.get(id);
    if (!sprite) return null;
    const bounds = sprite.getBounds();
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      centerX: sprite.x,
      centerY: sprite.y,
    };
  }

  public getGroupWorldBounds(id: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const group = this.compiled?.groups[id];
    if (!group) return null;
    const physicsGroup = this.formationPhysicsGroups.get(id);
    if (physicsGroup) {
      const rects = physicsGroup.getChildren()
        .map((child) => (child as any).body as Phaser.Physics.Arcade.Body | undefined)
        .filter((body): body is Phaser.Physics.Arcade.Body => Boolean(body))
        .map((body) => ({ minX: body.left, minY: body.top, maxX: body.right, maxY: body.bottom }));
      if (rects.length > 0) return computeAabbBounds(rects);
    }
    return group.getBounds();
  }

  public getEditableBoundsRect(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    return null;
  }

  public worldToClient(point: { x: number; y: number }): { x: number; y: number } | null {
    const canvas = this.game.canvas;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;
    const viewportCenterX = this.scale.width / 2;
    const viewportCenterY = this.scale.height / 2;
    const zoom = this.cameras.main.zoom || 1;

    return {
      x: rect.left + (((point.x - this.cameras.main.scrollX - viewportCenterX) * zoom) + viewportCenterX) * scaleX,
      y: rect.top + (((point.y - this.cameras.main.scrollY - viewportCenterY) * zoom) + viewportCenterY) * scaleY,
    };
  }

  public computeAutoHitboxForEntity(_entityId: string, _options: { alphaThreshold?: number } = {}): HitboxSpec | null {
    return null;
  }

  public testTapWorld(_point: { x: number; y: number }): void {}
  public testDragWorld(_start: { x: number; y: number }, _end: { x: number; y: number }): void {}
  public testDragBoundsHandle(_handle: string, _delta: { x: number; y: number }): void {}
  public testPanByScreenDelta(_delta: { x: number; y: number }): void {}
  public testUndo(): void {}
  public testRedo(): void {}

  update(_time: number, delta: number): void {
    if (!this.compiled) return;
    this.compiled.actionManager.update(delta);
    for (const entity of Object.values(this.compiled.entities)) {
      const sprite = this.sprites.get(entity.id);
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
      this.applyEntityDisplayProps(sprite, entity, this.compiled.scene.entities[entity.id]?.asset as any);
      this.syncPhysicsState(entity.id, sprite, entity);
    }
  }

  private clearScene(): void {
    this.formationPhysicsGroups.forEach((group) => group.destroy());
    this.formationPhysicsGroups.clear();
    this.physicsObjects.clear();
    this.physicsVelocityCache.clear();
    this.physicsSizeCache.clear();
    this.sprites.forEach(sprite => sprite.destroy());
    this.sprites.clear();
  }

  private syncPhysicsState(
    entityId: string,
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    entity: CompiledScene['entities'][string]
  ): void {
    const physicsObject = this.physicsObjects.get(entityId);
    if (!physicsObject) return;
    if (physicsObject !== (sprite as any)) return;

    const body = physicsObject.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    const vx = entity.vx ?? 0;
    const vy = entity.vy ?? 0;
    const prevVel = this.physicsVelocityCache.get(entityId);
    if (!prevVel || prevVel.vx !== vx || prevVel.vy !== vy) {
      body.velocity.set(vx, vy);
      this.physicsVelocityCache.set(entityId, { vx, vy });
    }

    const w = sprite instanceof Phaser.GameObjects.Rectangle ? entity.width : sprite.displayWidth;
    const h = sprite instanceof Phaser.GameObjects.Rectangle ? entity.height : sprite.displayHeight;
    const prevSize = this.physicsSizeCache.get(entityId);
    if (!prevSize || prevSize.w !== w || prevSize.h !== h) {
      body.setSize(w, h, true);
      this.physicsSizeCache.set(entityId, { w, h });
    }

    const anyBody = body as any;
    if (typeof anyBody.updateFromGameObject === 'function') {
      anyBody.updateFromGameObject();
    }
  }

  private getTextureKey(asset: SpriteAssetSpec): string {
    const sourceKey = asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path;
    const suffix = asset.imageType === 'spritesheet' && asset.grid
      ? `:${asset.grid.frameWidth}x${asset.grid.frameHeight}`
      : '';
    return `asset:${sourceKey}${suffix}`;
  }

  private applyEntityDisplayProps(
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    entity: CompiledScene['entities'][string],
    asset?: SpriteAssetSpec
  ): void {
    sprite.setPosition(entity.x, entity.y);
    sprite.setAngle(entity.rotationDeg ?? 0);
    sprite.setOrigin(entity.originX ?? 0.5, entity.originY ?? 0.5);
    sprite.setAlpha(entity.alpha ?? 1);
    sprite.setVisible(entity.visible ?? true);
    sprite.setDepth(entity.depth ?? 0);
    if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setSize(entity.width, entity.height);
      sprite.setDisplaySize(entity.width, entity.height);
      sprite.setScale((entity.flipX ? -1 : 1) * Math.abs(entity.scaleX ?? 1), (entity.flipY ? -1 : 1) * Math.abs(entity.scaleY ?? 1));
    } else {
      const displayWidth = entity.width * Math.abs(entity.scaleX ?? 1);
      const displayHeight = entity.height * Math.abs(entity.scaleY ?? 1);
      sprite.setDisplaySize(displayWidth, displayHeight);
      sprite.setFlipX(entity.flipX ?? false);
      sprite.setFlipY(entity.flipY ?? false);
      if (asset?.imageType === 'spritesheet' && sprite instanceof Phaser.GameObjects.Sprite) {
        const frame = asset.frame?.frameKey ?? asset.frame?.frameIndex;
        if (frame !== undefined) {
          sprite.setFrame(frame);
        }
      }
    }
  }

  private ensurePlaceholderTexture(): void {
    if (this.textures.exists(PLACEHOLDER_TEXTURE_KEY)) return;
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 1, 1);
    gfx.generateTexture(PLACEHOLDER_TEXTURE_KEY, 1, 1);
    gfx.destroy();
  }

  private configurePhysicsObject(entityId: string, sprite: PhysicsObject): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    body.setAllowGravity(false);
    body.moves = false;
    body.setImmovable(true);
    this.physicsObjects.set(entityId, sprite);
  }

  private buildSprites(): void {
    if (!this.compiled) return;
    this.ensurePlaceholderTexture();
    for (const entity of Object.values(this.compiled.entities)) {
      const asset = this.compiled.scene.entities[entity.id]?.asset as any as SpriteAssetSpec | undefined;
      const textureKey = asset ? this.getTextureKey(asset) : undefined;
      let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (asset && textureKey && this.textures.exists(textureKey)) {
        const frame = asset.frame?.frameKey ?? asset.frame?.frameIndex;
        if (asset.imageType === 'spritesheet') {
          sprite = this.physics.add.sprite(entity.x, entity.y, textureKey, frame);
        } else {
          sprite = this.physics.add.image(entity.x, entity.y, textureKey);
        }
      } else {
        sprite = this.physics.add.image(entity.x, entity.y, PLACEHOLDER_TEXTURE_KEY);
      }
      this.configurePhysicsObject(entity.id, sprite as any);
      sprite.setInteractive();
      this.applyEntityDisplayProps(sprite, entity, asset);
      this.sprites.set(entity.id, sprite);
    }
  }

  private buildFormationPhysicsGroups(scene: SceneSpec): void {
    if (!this.compiled) return;

    for (const [groupId, groupSpec] of Object.entries(scene.groups)) {
      const physicsGroup = this.physics.add.group();
      for (const memberId of groupSpec.members) {
        const obj = this.physicsObjects.get(memberId);
        if (obj) physicsGroup.add(obj);
      }
      this.formationPhysicsGroups.set(groupId, physicsGroup);
    }
  }

  private async ensureAssetTextures(sceneSpec: SceneSpec): Promise<void> {
    const pendingAssets = Object.values(sceneSpec.entities)
      .map((entity) => entity.asset)
      .filter((asset): asset is SpriteAssetSpec => Boolean(asset))
      .filter((asset) => !this.textures.exists(this.getTextureKey(asset)));

    if (pendingAssets.length === 0) return;

    for (const asset of pendingAssets) {
      const key = this.getTextureKey(asset);
      if (asset.imageType === 'spritesheet' && asset.grid) {
        this.load.spritesheet(key, asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path, {
          frameWidth: asset.grid.frameWidth,
          frameHeight: asset.grid.frameHeight,
        });
      } else {
        this.load.image(key, asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path);
      }
    }

    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.LOAD_ERROR, () => resolve());
      this.load.start();
    });
  }
}
