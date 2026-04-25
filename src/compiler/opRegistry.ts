import type { CallActionSpec } from '../model/types';
import type { CompileContext } from './compileBehaviors';

export type OpHandler = (action: CallActionSpec, ctx: CompileContext) => void;

export class OpRegistry {
  private handlers = new Map<string, OpHandler>();

  register(opId: string, handler: OpHandler): void {
    this.handlers.set(opId, handler);
  }

  has(opId: string): boolean {
    return this.handlers.has(opId);
  }

  invoke(opId: string, action: CallActionSpec, ctx: CompileContext): void {
    const handler = this.handlers.get(opId);
    if (!handler) {
      console.warn(`[phaseractions] Missing op handler for ${opId}`);
      return;
    }
    handler(action, ctx);
  }
}

