import type { CallActionSpec } from '../model/types';
import type { CompileContext } from './compileBehaviors';

export type OpHandler = (action: CallActionSpec, ctx: CompileContext) => void;

export class OpRegistry {
  private handlers = new Map<string, OpHandler>();
  private debugInvocations: string[] = [];
  private debugErrors: Array<{ opId: string; message: string }> = [];
  private debugCalls: Array<{ opId: string; target?: unknown; args?: unknown }> = [];

  register(opId: string, handler: OpHandler): void {
    this.handlers.set(opId, handler);
  }

  has(opId: string): boolean {
    return this.handlers.has(opId);
  }

  getDebugSnapshot(): { lastInvocations: string[]; lastErrors: Array<{ opId: string; message: string }>; lastCalls: Array<{ opId: string; target?: unknown; args?: unknown }> } {
    return { lastInvocations: [...this.debugInvocations], lastErrors: [...this.debugErrors], lastCalls: [...this.debugCalls] };
  }

  invoke(opId: string, action: CallActionSpec, ctx: CompileContext): void {
    this.debugInvocations.push(opId);
    if (this.debugInvocations.length > 50) {
      this.debugInvocations.splice(0, this.debugInvocations.length - 50);
    }
    this.debugCalls.push({ opId, target: (action as any)?.target, args: (action as any)?.args });
    if (this.debugCalls.length > 20) {
      this.debugCalls.splice(0, this.debugCalls.length - 20);
    }
    const handler = this.handlers.get(opId);
    if (!handler) {
      console.warn(`[phaseractions] Missing op handler for ${opId}`);
      return;
    }
    try {
      handler(action, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.debugErrors.push({ opId, message });
      if (this.debugErrors.length > 20) {
        this.debugErrors.splice(0, this.debugErrors.length - 20);
      }
      console.error(`[phaseractions] Op handler threw for ${opId}: ${message}`);
    }
  }
}
