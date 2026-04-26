import { describe, expect, it } from 'vitest';
import { BasicCollisionService } from '../../src/runtime/services/BasicCollisionService';

describe('BasicCollisionService', () => {
  it('emits enter/stay/exit for trigger zones based on AABB overlap', () => {
    const svc = new BasicCollisionService();
    svc.setTriggers([
      {
        id: 't1',
        name: 'zone',
        enabled: true,
        rect: { x: 100, y: 100, width: 50, height: 40 },
      },
    ]);

    svc.setEntities({
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 },
    });
    svc.update();
    expect(svc.getSnapshot().triggerEvents).toEqual([]);

    svc.setEntities({
      e1: { id: 'e1', x: 110, y: 110, width: 10, height: 10 },
    });
    svc.update();
    expect(svc.getSnapshot().triggerEvents.at(-1)).toEqual({ id: 't1', type: 'enter', entityId: 'e1' });

    svc.update();
    expect(svc.getSnapshot().triggerEvents.at(-1)).toEqual({ id: 't1', type: 'stay', entityId: 'e1' });

    svc.setEntities({
      e1: { id: 'e1', x: 10, y: 10, width: 10, height: 10 },
    });
    svc.update();
    expect(svc.getSnapshot().triggerEvents.at(-1)).toEqual({ id: 't1', type: 'exit', entityId: 'e1' });
  });

  it('emits click events when pointer down occurs inside a trigger zone', () => {
    const svc = new BasicCollisionService();
    svc.setTriggers([
      {
        id: 't1',
        enabled: true,
        rect: { x: 100, y: 100, width: 50, height: 40 },
      },
    ]);

    svc.handlePointerDown({ worldX: 110, worldY: 120, button: 0 });
    svc.update();
    expect(svc.getSnapshot().triggerEvents.at(-1)).toEqual({ id: 't1', type: 'click', button: 0 });
  });
});

