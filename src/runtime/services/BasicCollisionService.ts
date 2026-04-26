import type { CollisionRuleSpec, TriggerZoneSpec } from '../../model/types';

export type TriggerEvent =
  | { id: string; type: 'enter' | 'stay' | 'exit'; entityId: string }
  | { id: string; type: 'click'; button: number; entityId?: string };

export type CollisionEvent = { ruleId: string; type: 'enter' | 'stay' | 'exit'; aId: string; bId: string; interaction: 'block' | 'overlap' };

export interface CollisionSnapshot {
  triggerEvents: TriggerEvent[];
  collisionEvents: CollisionEvent[];
}

type SimpleEntity = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  body?: { enabled?: boolean; kind?: 'static' | 'dynamic' };
  collision?: { enabled?: boolean; layer?: string };
  destroyed?: boolean;
};

function intersectsAabb(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function entityAabb(entity: SimpleEntity): { minX: number; minY: number; maxX: number; maxY: number } {
  const halfW = entity.width / 2;
  const halfH = entity.height / 2;
  return { minX: entity.x - halfW, minY: entity.y - halfH, maxX: entity.x + halfW, maxY: entity.y + halfH };
}

function zoneAabb(zone: TriggerZoneSpec): { minX: number; minY: number; maxX: number; maxY: number } {
  const r = zone.rect;
  return { minX: r.x, minY: r.y, maxX: r.x + r.width, maxY: r.y + r.height };
}

export class BasicCollisionService {
  private triggers: TriggerZoneSpec[] = [];
  private collisionRules: CollisionRuleSpec[] = [];
  private entities: Record<string, SimpleEntity> = {};
  private activeOverlaps = new Set<string>();
  private triggerEvents: TriggerEvent[] = [];
  private activeCollisions = new Set<string>();
  private collisionEvents: CollisionEvent[] = [];
  private pendingPointerDown: Array<{ worldX: number; worldY: number; button: number }> = [];

  public setTriggers(triggers: TriggerZoneSpec[]): void {
    this.triggers = Array.isArray(triggers) ? triggers.map((t) => JSON.parse(JSON.stringify(t))) : [];
    this.activeOverlaps.clear();
  }

  public setCollisionRules(rules: CollisionRuleSpec[]): void {
    this.collisionRules = Array.isArray(rules) ? rules.map((r) => JSON.parse(JSON.stringify(r))) : [];
    this.activeCollisions.clear();
  }

  public setEntities(entities: Record<string, SimpleEntity>): void {
    this.entities = entities;
  }

  public handlePointerDown(event: { worldX: number; worldY: number; button: number }): void {
    if (!Number.isFinite(event.worldX) || !Number.isFinite(event.worldY)) return;
    const button = Number.isFinite(event.button) ? Math.trunc(event.button) : 0;
    this.pendingPointerDown.push({ worldX: event.worldX, worldY: event.worldY, button });
  }

  public update(): void {
    this.processPointerDownClicks();
    this.processTriggerOverlaps();
    this.processEntityCollisions();
    if (this.triggerEvents.length > 200) {
      this.triggerEvents.splice(0, this.triggerEvents.length - 200);
    }
    if (this.collisionEvents.length > 200) {
      this.collisionEvents.splice(0, this.collisionEvents.length - 200);
    }
  }

  public getSnapshot(): CollisionSnapshot {
    return { triggerEvents: [...this.triggerEvents], collisionEvents: [...this.collisionEvents] };
  }

  private processPointerDownClicks(): void {
    if (this.pendingPointerDown.length === 0) return;
    const points = this.pendingPointerDown.splice(0, this.pendingPointerDown.length);
    for (const point of points) {
      for (const zone of this.triggers) {
        if (zone.enabled === false) continue;
        const aabb = zoneAabb(zone);
        if (point.worldX >= aabb.minX && point.worldX <= aabb.maxX && point.worldY >= aabb.minY && point.worldY <= aabb.maxY) {
          const entityId = this.findEntityAtPoint(point.worldX, point.worldY);
          this.triggerEvents.push(entityId ? { id: zone.id, type: 'click', button: point.button, entityId } : { id: zone.id, type: 'click', button: point.button });
        }
      }
    }
  }

  private findEntityAtPoint(worldX: number, worldY: number): string | undefined {
    const ids = Object.keys(this.entities).sort();
    for (const id of ids) {
      const entity = this.entities[id];
      if (!entity || entity.destroyed) continue;
      const halfW = entity.width / 2;
      const halfH = entity.height / 2;
      if (worldX >= entity.x - halfW && worldX <= entity.x + halfW && worldY >= entity.y - halfH && worldY <= entity.y + halfH) {
        return entity.id;
      }
    }
    return undefined;
  }

  private processTriggerOverlaps(): void {
    const nextOverlaps = new Set<string>();

    for (const zone of this.triggers) {
      if (zone.enabled === false) continue;
      const z = zoneAabb(zone);
      for (const entity of Object.values(this.entities)) {
        if (entity.destroyed) continue;
        const e = entityAabb(entity);
        const key = `${zone.id}|${entity.id}`;
        if (intersectsAabb(e, z)) {
          nextOverlaps.add(key);
          if (this.activeOverlaps.has(key)) {
            this.triggerEvents.push({ id: zone.id, type: 'stay', entityId: entity.id });
          } else {
            this.triggerEvents.push({ id: zone.id, type: 'enter', entityId: entity.id });
          }
        } else if (this.activeOverlaps.has(key)) {
          this.triggerEvents.push({ id: zone.id, type: 'exit', entityId: entity.id });
        }
      }
    }

    this.activeOverlaps = nextOverlaps;
  }

  private processEntityCollisions(): void {
    if (this.collisionRules.length === 0) return;

    const layers = new Map<string, SimpleEntity[]>();
    for (const entity of Object.values(this.entities)) {
      if (entity.destroyed) continue;
      const collision = entity.collision;
      if (!collision || collision.enabled === false) continue;
      const layer = typeof collision.layer === 'string' ? collision.layer : '';
      if (!layer) continue;
      const bucket = layers.get(layer) ?? [];
      bucket.push(entity);
      layers.set(layer, bucket);
    }

    const nextCollisions = new Set<string>();

    for (const rule of this.collisionRules) {
      const aLayer = rule.a.layer;
      const bLayer = rule.b.layer;
      const aEntities = layers.get(aLayer) ?? [];
      const bEntities = layers.get(bLayer) ?? [];
      for (let i = 0; i < aEntities.length; i += 1) {
        const a = aEntities[i];
        for (let j = 0; j < bEntities.length; j += 1) {
          const b = bEntities[j];
          if (a.id === b.id) continue;
          if (aLayer === bLayer && j <= i) continue;

          const overlap = intersectsAabb(entityAabb(a), entityAabb(b));
          const key = `${rule.id}|${a.id}|${b.id}`;

          if (overlap) {
            nextCollisions.add(key);
            if (this.activeCollisions.has(key)) {
              this.collisionEvents.push({ ruleId: rule.id, type: 'stay', aId: a.id, bId: b.id, interaction: rule.interaction });
            } else {
              this.collisionEvents.push({ ruleId: rule.id, type: 'enter', aId: a.id, bId: b.id, interaction: rule.interaction });
            }

            if (rule.interaction === 'block') {
              this.resolveBlock(a, b);
            }
          } else if (this.activeCollisions.has(key)) {
            this.collisionEvents.push({ ruleId: rule.id, type: 'exit', aId: a.id, bId: b.id, interaction: rule.interaction });
          }
        }
      }
    }

    this.activeCollisions = nextCollisions;
  }

  private resolveBlock(a: SimpleEntity, b: SimpleEntity): void {
    const aDynamic = a.body?.enabled && a.body.kind === 'dynamic';
    const bDynamic = b.body?.enabled && b.body.kind === 'dynamic';
    const movable = aDynamic ? a : (bDynamic ? b : null);
    const other = movable === a ? b : (movable === b ? a : null);
    if (!movable || !other) return;

    const ma = entityAabb(movable);
    const oa = entityAabb(other);
    if (!intersectsAabb(ma, oa)) return;

    const penLeft = ma.maxX - oa.minX;
    const penRight = oa.maxX - ma.minX;
    const penTop = ma.maxY - oa.minY;
    const penBottom = oa.maxY - ma.minY;
    const penX = Math.min(penLeft, penRight);
    const penY = Math.min(penTop, penBottom);
    if (penX <= 0 || penY <= 0) return;

    const centerDx = movable.x - other.x;
    const centerDy = movable.y - other.y;
    if (penX < penY) {
      movable.x += centerDx >= 0 ? penX : -penX;
    } else {
      movable.y += centerDy >= 0 ? penY : -penY;
    }
  }
}
