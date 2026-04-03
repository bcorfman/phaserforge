import { Action } from './Action';

export class ActionManager {
  private actions: Action[] = [];

  add(action: Action): void {
    action.start();
    this.actions.push(action);
  }

  update(dtMs: number): void {
    for (const action of this.actions) {
      action.update(dtMs);
    }
    this.actions = this.actions.filter((action) => !action.isComplete());
  }

  clear(): void {
    this.actions = [];
  }

  size(): number {
    return this.actions.length;
  }
}
