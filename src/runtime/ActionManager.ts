import { Action } from './Action';

export interface ActionMetadata {
  targetKey?: string;
  tag?: string;
}

interface ManagedAction {
  action: Action;
  meta: ActionMetadata;
}

export class ActionManager {
  private actions: ManagedAction[] = [];

  add(action: Action, meta: ActionMetadata = {}): void {
    action.start();
    this.actions.push({ action, meta });
  }

  update(dtMs: number): void {
    for (const { action } of this.actions) {
      action.update(dtMs);
    }
    this.actions = this.actions.filter(({ action }) => !action.isComplete());
  }

  clear(): void {
    for (const { action } of this.actions) {
      action.stop?.();
      action.cancel?.();
    }
    this.actions = [];
  }

  stopAll(): void {
    this.clear();
  }

  getActionsForTarget(targetKey: string, tag?: string): Action[] {
    return this.actions
      .filter(({ meta }) => meta.targetKey === targetKey && (tag === undefined || meta.tag === tag))
      .map(({ action }) => action);
  }

  stopActionsForTarget(targetKey: string, tag?: string): void {
    for (const { action, meta } of this.actions) {
      if (meta.targetKey !== targetKey) continue;
      if (tag !== undefined && meta.tag !== tag) continue;
      action.stop?.();
      action.cancel?.();
    }
    this.actions = this.actions.filter(({ action }) => !action.isComplete());
  }

  size(): number {
    return this.actions.length;
  }
}
