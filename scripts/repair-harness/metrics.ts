import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { FailureClass } from './types';
import { redactSecrets } from './artifacts';

export type OutcomeStatus = 'verified' | 'failed' | 'stopped';
export type HumanAcceptance = 'accepted' | 'rejected' | 'pending';

export interface RepairOutcome {
  runId: string;
  failureClass: FailureClass;
  reproduction: { matched?: boolean; durationMs?: number };
  focusedVerification?: { status: string; durationMs?: number };
  requiredVerification?: { status: string; durationMs?: number };
  attempts: number;
  packetBytes: number;
  tokenUsage?: { input?: number; output?: number };
  humanAcceptance: HumanAcceptance;
  status: OutcomeStatus;
  stopReason?: string;
}

export interface RepairMetrics {
  runs: number;
  verified: number;
  failed: number;
  stopped: number;
  byFailureClass: Partial<Record<FailureClass, number>>;
  reproduction: { matched: number; mismatched: number; unknown: number; rate: number };
  durationsMs: { focused: number[]; required: number[] };
  attempts: { total: number; max: number };
  packetBytes: { total: number; max: number };
  tokenUsage: { knownCalls: number; unknownRuns: number; input: number; output: number };
  humanAcceptance: Record<HumanAcceptance, number>;
  stopReasons: Record<string, number>;
}

export function createRepairOutcome(outcome: RepairOutcome): RepairOutcome {
  return {
    ...outcome,
    stopReason: outcome.stopReason ? redactSecrets(outcome.stopReason) : undefined,
  };
}

export function aggregateRepairOutcomes(outcomes: RepairOutcome[]): RepairMetrics {
  const metrics: RepairMetrics = {
    runs: outcomes.length, verified: 0, failed: 0, stopped: 0, byFailureClass: {},
    reproduction: { matched: 0, mismatched: 0, unknown: 0, rate: 0 }, durationsMs: { focused: [], required: [] },
    attempts: { total: 0, max: 0 }, packetBytes: { total: 0, max: 0 },
    tokenUsage: { knownCalls: 0, unknownRuns: 0, input: 0, output: 0 },
    humanAcceptance: { accepted: 0, rejected: 0, pending: 0 }, stopReasons: {},
  };
  for (const outcome of outcomes) {
    metrics[outcome.status] += 1;
    metrics.byFailureClass[outcome.failureClass] = (metrics.byFailureClass[outcome.failureClass] ?? 0) + 1;
    if (outcome.reproduction.matched === true) metrics.reproduction.matched += 1;
    else if (outcome.reproduction.matched === false) metrics.reproduction.mismatched += 1;
    else metrics.reproduction.unknown += 1;
    if (outcome.focusedVerification?.durationMs !== undefined) metrics.durationsMs.focused.push(outcome.focusedVerification.durationMs);
    if (outcome.requiredVerification?.durationMs !== undefined) metrics.durationsMs.required.push(outcome.requiredVerification.durationMs);
    metrics.attempts.total += outcome.attempts;
    metrics.attempts.max = Math.max(metrics.attempts.max, outcome.attempts);
    metrics.packetBytes.total += outcome.packetBytes;
    metrics.packetBytes.max = Math.max(metrics.packetBytes.max, outcome.packetBytes);
    if (!outcome.tokenUsage || (outcome.tokenUsage.input === undefined && outcome.tokenUsage.output === undefined)) metrics.tokenUsage.unknownRuns += 1;
    else {
      metrics.tokenUsage.knownCalls += 1;
      metrics.tokenUsage.input += outcome.tokenUsage.input ?? 0;
      metrics.tokenUsage.output += outcome.tokenUsage.output ?? 0;
    }
    metrics.humanAcceptance[outcome.humanAcceptance] += 1;
    if (outcome.stopReason) metrics.stopReasons[outcome.stopReason] = (metrics.stopReasons[outcome.stopReason] ?? 0) + 1;
  }
  const knownReproductions = metrics.reproduction.matched + metrics.reproduction.mismatched;
  metrics.reproduction.rate = knownReproductions ? metrics.reproduction.matched / knownReproductions : 0;
  return metrics;
}

export function writeRepairMetrics(directory: string, outcomes: RepairOutcome[]): RepairMetrics {
  const metrics = aggregateRepairOutcomes(outcomes);
  writeFileSync(path.join(directory, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  return metrics;
}

export function appendRepairOutcome(directory: string, outcome: RepairOutcome): void {
  appendFileSync(path.join(directory, 'outcomes.jsonl'), `${JSON.stringify(createRepairOutcome(outcome))}\n`);
}

export function readRepairOutcomes(directory: string): RepairOutcome[] {
  const file = path.join(directory, 'outcomes.jsonl');
  try { return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as RepairOutcome); }
  catch { return []; }
}

export function formatRepairMetrics(metrics: RepairMetrics): string {
  const tokenLine = metrics.tokenUsage.unknownRuns ? `Token usage: unavailable for ${metrics.tokenUsage.unknownRuns} run(s)` : `Token usage: ${metrics.tokenUsage.input} input / ${metrics.tokenUsage.output} output`;
  return [
    `Runs: ${metrics.runs}`,
    `Status: ${metrics.verified} verified, ${metrics.failed} failed, ${metrics.stopped} stopped`,
    `Reproduction rate: ${(metrics.reproduction.rate * 100).toFixed(1)}% (${metrics.reproduction.unknown} unknown)`,
    `Attempts: ${metrics.attempts.total} total, ${metrics.attempts.max} max`,
    `Packet bytes: ${metrics.packetBytes.total} total, ${metrics.packetBytes.max} max`,
    tokenLine,
    `Human acceptance: ${metrics.humanAcceptance.accepted} accepted, ${metrics.humanAcceptance.rejected} rejected, ${metrics.humanAcceptance.pending} pending`,
  ].join('\n');
}
