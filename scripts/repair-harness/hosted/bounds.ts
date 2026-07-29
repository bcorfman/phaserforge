import type { HostedConfig } from './config';

export interface HostedOperationBudget {
  browserCount: number;
  mutationCount: number;
  cleanupAttempts: number;
  timeoutMs: number;
}

export interface HostedOperationUsage extends HostedOperationBudget {
  elapsedMs: number;
}

export function hostedOperationBudget(config: HostedConfig): HostedOperationBudget {
  return { browserCount: config.maxBrowsers, mutationCount: config.maxMutations, cleanupAttempts: config.maxCleanupAttempts, timeoutMs: config.timeoutMs };
}

export function assertHostedBounds(budget: HostedOperationBudget, usage: HostedOperationUsage): void {
  if (usage.browserCount > budget.browserCount) throw new Error('Hosted browser budget exceeded.');
  if (usage.mutationCount > budget.mutationCount) throw new Error('Hosted mutation budget exceeded.');
  if (usage.cleanupAttempts > budget.cleanupAttempts) throw new Error('Hosted cleanup budget exceeded.');
  if (usage.elapsedMs >= budget.timeoutMs) throw new Error('Hosted timeout budget exceeded.');
}
