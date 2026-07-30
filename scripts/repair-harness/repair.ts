import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isHostedCommand } from './scope';
import path from 'node:path';

import { runAgent, parseDiagnosis, type AgentResult } from './agent';
import { redactSecrets } from './artifacts';
import { budgetAllows, recordAgentResult, tokenBudgetViolation, PHASE3_BUDGETS } from './budget';
import { createDiagnosisPacket, createImplementationPacket, writePacket } from './packet';
import { approveRepairRequest } from './policy';
import { appendEvent, readState, writeState, type RepairState } from './state';
import { verify, type VerificationResult } from './verify';
import type { EvidenceEnvelope, RepairDiagnosis } from './types';
import { appendRepairOutcome } from './metrics';

export interface RepairOptions { repo: string; runDirectory: string; evidence: EvidenceEnvelope; targetedFiles?: string[]; diff?: string; callAgent?: (kind: 'diagnosis' | 'implementation', packet: string) => Promise<AgentResult>; verifyPatch?: () => Promise<VerificationResult>; }
export interface RepairResult { status: 'verified' | 'stopped' | 'failed'; reason?: string; diagnosis?: RepairDiagnosis; verification?: VerificationResult; }

function currentDiff(repo: string): string { try { return execFileSync('git', ['diff', '--no-ext-diff'], { cwd: repo, encoding: 'utf8' }); } catch { return ''; } }

function stop(directory: string, state: RepairState, reason: string): RepairResult {
  writeState(directory, { ...state, phase: 'repair', status: 'stopped' });
  appendEvent(directory, { event: 'repair-stopped', reason });
  return { status: 'stopped', reason };
}

function outcome(options: RepairOptions, status: 'verified' | 'failed' | 'stopped', attempts: number, reason?: string, verification?: VerificationResult) {
  const state = readState(options.runDirectory);
  appendRepairOutcome(options.runDirectory, {
    runId: stateRunId(options.runDirectory), failureClass: options.evidence.failure.class,
    reproduction: {},
    focusedVerification: verification?.focused ? { status: verification.focused.status, durationMs: verification.focused.durationMs } : undefined,
    requiredVerification: verification?.required ? { status: verification.required.status, durationMs: verification.required.durationMs } : undefined,
    attempts: Math.max(attempts, state.budgets.implementationAttempts ?? 0), packetBytes: state.budgets.packetBytes ?? 0,
    tokenUsage: { input: state.budgets.inputTokens, output: state.budgets.outputTokens },
    humanAcceptance: 'pending', status, stopReason: reason,
  });
}

function stateRunId(directory: string): string {
  try { return readState(directory).runId; } catch { return path.basename(directory); }
}

export async function runBoundedRepair(options: RepairOptions): Promise<RepairResult> {
  let state = readState(options.runDirectory);
  if (isHostedCommand(options.evidence.reproduction.command)) { const reason = 'Hosted validation is outside the Codex repair path; no agent or remote mutation is permitted.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  if (options.evidence.failure.class === 'infrastructure') { const reason = 'Infrastructure failure; no model call permitted.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  const diff = options.diff ?? currentDiff(options.repo);
  const call = options.callAgent ?? ((kind, packet) => runAgent({ kind, packet, cwd: options.repo, timeoutMs: Math.max(1, PHASE3_BUDGETS.wallTimeMs - (state.budgets.wallTimeMs ?? 0)) }));
  const diagnosisPacket = createDiagnosisPacket({ repo: options.repo, evidence: options.evidence, diff, targetedFiles: options.targetedFiles });
  if (!budgetAllows(state, 'diagnosis', state.budgets.wallTimeMs ?? 0, Buffer.byteLength(diagnosisPacket))) { const reason = 'Diagnosis budget exhausted.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  const diagnosisResult = await call('diagnosis', diagnosisPacket);
  state = recordAgentResult(state, diagnosisResult);
  writeState(options.runDirectory, { ...state, phase: 'diagnosis' });
  writePacket(options.runDirectory, 'diagnosis.md', diagnosisPacket);
  writeFileSync(path.join(options.runDirectory, 'packets', 'diagnosis-response.txt'), redactSecrets(diagnosisResult.stdout));
  appendEvent(options.runDirectory, { event: 'diagnosis-completed', exitCode: diagnosisResult.exitCode, packetBytes: diagnosisResult.packetBytes });
  const diagnosisBudgetViolation = tokenBudgetViolation('diagnosis', diagnosisResult);
  if (diagnosisBudgetViolation) { outcome(options, 'stopped', 0, diagnosisBudgetViolation); return stop(options.runDirectory, state, diagnosisBudgetViolation); }
  if (diagnosisResult.exitCode !== 0) { const reason = 'Diagnosis command failed.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  let diagnosis: RepairDiagnosis;
  try { diagnosis = parseDiagnosis(diagnosisResult.stdout); } catch (error) { const reason = error instanceof Error ? error.message : String(error); outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  if (diagnosis.reproductionCommand !== options.evidence.reproduction.command) { const reason = 'Diagnosis reproduction command does not match the collected CI command.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  const approval = approveRepairRequest({ failureClass: diagnosis.failureClass, requestedFiles: diagnosis.files, currentDiff: diff });
  if (!approval.allowed) { const reason = approval.violations.join(' '); outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  const implementationPacket = createImplementationPacket({ repo: options.repo, evidence: options.evidence, diff, targetedFiles: diagnosis.files, diagnosis });
  writePacket(options.runDirectory, 'implementation.md', implementationPacket);
  if (!budgetAllows(state, 'implementation', state.budgets.wallTimeMs ?? 0, Buffer.byteLength(implementationPacket))) { const reason = 'Implementation budget exhausted.'; outcome(options, 'stopped', 0, reason); return stop(options.runDirectory, state, reason); }
  const implementationResult = await call('implementation', implementationPacket);
  state = recordAgentResult(state, implementationResult);
  writeState(options.runDirectory, { ...state, phase: 'implementation' });
  appendEvent(options.runDirectory, { event: 'implementation-completed', exitCode: implementationResult.exitCode, packetBytes: implementationResult.packetBytes });
  const implementationBudgetViolation = tokenBudgetViolation('implementation', implementationResult);
  if (implementationBudgetViolation) { const reason = implementationBudgetViolation; outcome(options, 'stopped', 1, reason); return stop(options.runDirectory, state, reason); }
  if (implementationResult.exitCode !== 0) { const reason = 'Implementation command failed.'; outcome(options, 'failed', 1, reason); return { status: 'failed', diagnosis, reason }; }
  const verification = await (options.verifyPatch ?? (() => verify({ evidence: options.evidence, cwd: options.repo })));
  mkdirSync(path.join(options.runDirectory, 'verification'), { recursive: true });
  writeFileSync(path.join(options.runDirectory, 'verification', 'result.json'), `${JSON.stringify(verification, null, 2)}\n`);
  const status = verification.verified ? 'verified' : 'failed';
  outcome(options, status, 1, verification.reason, verification);
  writeState(options.runDirectory, { ...state, phase: 'verify', status });
  appendEvent(options.runDirectory, { event: 'repair-verification-completed', verified: verification.verified });
  writeFileSync(path.join(options.runDirectory, 'summary.md'), `# CI repair summary\n\n- Status: ${verification.verified ? 'verified' : 'failed'}\n- Diagnosis cause: ${diagnosis.likelyCause}\n- Required verification: \`${verification.requiredCommand}\`\n\n${verification.reason ?? 'Independent verification passed.'}\n`);
  return { status, diagnosis, verification, reason: verification.reason };
}
