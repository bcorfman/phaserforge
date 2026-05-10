import { describe, expect, it } from 'vitest';
import { ActionBase } from '../../src/runtime/Action';
import { ActionManager } from '../../src/runtime/ActionManager';

class CountingAction extends ActionBase {
  public updates = 0;
  public removed = 0;

  update(_dtMs: number): void {
    if (this.complete || this.cancelled) return;
    this.updates += 1;
  }

  protected removeEffect(): void {
    this.removed += 1;
  }
}

describe('stop semantics', () => {
  it('S1 stop() is idempotent and removes effect once', () => {
    const action = new CountingAction();
    action.start();
    action.update(16);
    expect(action.updates).toBe(1);
    action.stop();
    action.stop();
    expect(action.isComplete()).toBe(true);
    expect(action.removed).toBe(1);
    action.update(16);
    expect(action.updates).toBe(1);
  });

  it('S2 ActionManager.clear() stops all actions', () => {
    const manager = new ActionManager();
    const a = new CountingAction();
    const b = new CountingAction();
    manager.add(a);
    manager.add(b);
    manager.clear();
    expect(a.removed).toBe(1);
    expect(b.removed).toBe(1);
    expect(manager.size()).toBe(0);
  });

  it('S3 stopActionsForTarget stops only matching target/tag', () => {
    const manager = new ActionManager();
    const a = new CountingAction();
    const b = new CountingAction();
    const c = new CountingAction();
    manager.add(a, { targetKey: 'entity:e1', tag: 'a' });
    manager.add(b, { targetKey: 'entity:e1', tag: 'b' });
    manager.add(c, { targetKey: 'entity:e2', tag: 'a' });
    manager.stopActionsForTarget('entity:e1', 'a');
    expect(a.removed).toBe(1);
    expect(b.removed).toBe(0);
    expect(c.removed).toBe(0);
    expect(manager.size()).toBe(2);
  });
});
