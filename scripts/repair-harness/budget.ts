import type { AgentCallKind, AgentResult } from './agent';
import type { RepairState } from './state';

export const PHASE3_BUDGETS = { diagnosisCalls: 1, implementationAttempts: 2, wallTimeMs: 20 * 60 * 1000, diagnosisInputTokens: 4000, diagnosisOutputTokens: 800, implementationInputTokens: 8000, implementationOutputTokens: 2000 } as const;

export function budgetKey(kind: AgentCallKind): 'diagnosisCalls' | 'implementationAttempts' { return kind === 'diagnosis' ? 'diagnosisCalls' : 'implementationAttempts'; }

export function budgetAllows(state: RepairState, kind: AgentCallKind, elapsedMs: number, packetBytes = 0): boolean {
  const key = budgetKey(kind);
  const tokenLimit = kind === 'diagnosis' ? PHASE3_BUDGETS.diagnosisInputTokens : PHASE3_BUDGETS.implementationInputTokens;
  return (state.budgets[key] ?? 0) < PHASE3_BUDGETS[key] && elapsedMs < PHASE3_BUDGETS.wallTimeMs && packetBytes <= tokenLimit * 4;
}

export function recordAgentResult(state: RepairState, result: AgentResult): RepairState {
  const key = budgetKey(result.kind);
  const budgets = { ...state.budgets, [key]: (state.budgets[key] ?? 0) + 1, packetBytes: (state.budgets.packetBytes ?? 0) + result.packetBytes, wallTimeMs: (state.budgets.wallTimeMs ?? 0) + result.durationMs };
  if (result.tokenUsage?.input !== undefined) budgets.inputTokens = (budgets.inputTokens ?? 0) + result.tokenUsage.input;
  if (result.tokenUsage?.output !== undefined) budgets.outputTokens = (budgets.outputTokens ?? 0) + result.tokenUsage.output;
  return { ...state, budgets, updatedAt: new Date().toISOString() };
}

export function tokenBudgetViolation(kind: AgentCallKind, result: AgentResult): string | undefined {
  const inputLimit = kind === 'diagnosis' ? PHASE3_BUDGETS.diagnosisInputTokens : PHASE3_BUDGETS.implementationInputTokens;
  const outputLimit = kind === 'diagnosis' ? PHASE3_BUDGETS.diagnosisOutputTokens : PHASE3_BUDGETS.implementationOutputTokens;
  if (result.tokenUsage?.input !== undefined && result.tokenUsage.input > inputLimit) return `${kind} input token budget exceeded.`;
  if (result.tokenUsage?.output !== undefined && result.tokenUsage.output > outputLimit) return `${kind} output token budget exceeded.`;
  return undefined;
}
