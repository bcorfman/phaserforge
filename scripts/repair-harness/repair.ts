import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { runAgent, parseDiagnosis, type AgentResult } from './agent';
import { budgetAllows, recordAgentResult, tokenBudgetViolation, PHASE3_BUDGETS } from './budget';
import { createDiagnosisPacket, createImplementationPacket, writePacket } from './packet';
import { approveRepairRequest } from './policy';
import { appendEvent, readState, writeState, type RepairState } from './state';
import { verify, type VerificationResult } from './verify';
import type { EvidenceEnvelope, RepairDiagnosis } from './types';

export interface RepairOptions { repo: string; runDirectory: string; evidence: EvidenceEnvelope; targetedFiles?: string[]; diff?: string; callAgent?: (kind: 'diagnosis' | 'implementation', packet: string) => Promise<AgentResult>; verifyPatch?: () => Promise<VerificationResult>; }
export interface RepairResult { status: 'verified' | 'stopped' | 'failed'; reason?: string; diagnosis?: RepairDiagnosis; verification?: VerificationResult; }

function currentDiff(repo: string): string { try { return execFileSync('git', ['diff', '--no-ext-diff'], { cwd: repo, encoding: 'utf8' }); } catch { return ''; } }

function stop(directory: string, state: RepairState, reason: string): RepairResult {
  writeState(directory, { ...state, phase: 'repair', status: 'stopped' });
  appendEvent(directory, { event: 'repair-stopped', reason });
  return { status: 'stopped', reason };
}

export async function runBoundedRepair(options: RepairOptions): Promise<RepairResult> {
  let state = readState(options.runDirectory);
  if (options.evidence.failure.class === 'infrastructure') return stop(options.runDirectory, state, 'Infrastructure failure; no model call permitted.');
  const diff = options.diff ?? currentDiff(options.repo);
  const call = options.callAgent ?? ((kind, packet) => runAgent({ kind, packet, cwd: options.repo, timeoutMs: Math.max(1, PHASE3_BUDGETS.wallTimeMs - (state.budgets.wallTimeMs ?? 0)) }));
  const diagnosisPacket = createDiagnosisPacket({ repo: options.repo, evidence: options.evidence, diff, targetedFiles: options.targetedFiles });
  if (!budgetAllows(state, 'diagnosis', state.budgets.wallTimeMs ?? 0, Buffer.byteLength(diagnosisPacket))) return stop(options.runDirectory, state, 'Diagnosis budget exhausted.');
  const diagnosisResult = await call('diagnosis', diagnosisPacket);
  state = recordAgentResult(state, diagnosisResult);
  writeState(options.runDirectory, { ...state, phase: 'diagnosis' });
  writePacket(options.runDirectory, 'diagnosis.md', diagnosisPacket);
  appendEvent(options.runDirectory, { event: 'diagnosis-completed', exitCode: diagnosisResult.exitCode, packetBytes: diagnosisResult.packetBytes });
  const diagnosisBudgetViolation = tokenBudgetViolation('diagnosis', diagnosisResult);
  if (diagnosisBudgetViolation) return stop(options.runDirectory, state, diagnosisBudgetViolation);
  if (diagnosisResult.exitCode !== 0) return stop(options.runDirectory, state, 'Diagnosis command failed.');
  let diagnosis: RepairDiagnosis;
  try { diagnosis = parseDiagnosis(diagnosisResult.stdout); } catch (error) { return stop(options.runDirectory, state, error instanceof Error ? error.message : String(error)); }
  if (diagnosis.reproductionCommand !== options.evidence.reproduction.command) return stop(options.runDirectory, state, 'Diagnosis reproduction command does not match the collected CI command.');
  const approval = approveRepairRequest({ failureClass: diagnosis.failureClass, requestedFiles: diagnosis.files, currentDiff: diff });
  if (!approval.allowed) return stop(options.runDirectory, state, approval.violations.join(' '));
  const implementationPacket = createImplementationPacket({ repo: options.repo, evidence: options.evidence, diff, targetedFiles: diagnosis.files, diagnosis });
  writePacket(options.runDirectory, 'implementation.md', implementationPacket);
  if (!budgetAllows(state, 'implementation', state.budgets.wallTimeMs ?? 0, Buffer.byteLength(implementationPacket))) return stop(options.runDirectory, state, 'Implementation budget exhausted.');
  const implementationResult = await call('implementation', implementationPacket);
  state = recordAgentResult(state, implementationResult);
  writeState(options.runDirectory, { ...state, phase: 'implementation' });
  appendEvent(options.runDirectory, { event: 'implementation-completed', exitCode: implementationResult.exitCode, packetBytes: implementationResult.packetBytes });
  const implementationBudgetViolation = tokenBudgetViolation('implementation', implementationResult);
  if (implementationBudgetViolation) return stop(options.runDirectory, state, implementationBudgetViolation);
  if (implementationResult.exitCode !== 0) return { status: 'failed', diagnosis, reason: 'Implementation command failed.' };
  const verification = await (options.verifyPatch ?? (() => verify({ evidence: options.evidence, cwd: options.repo })));
  const status = verification.verified ? 'verified' : 'failed';
  writeState(options.runDirectory, { ...state, phase: 'verify', status });
  appendEvent(options.runDirectory, { event: 'repair-verification-completed', verified: verification.verified });
  writeFileSync(path.join(options.runDirectory, 'summary.md'), `# CI repair summary\n\n- Status: ${verification.verified ? 'verified' : 'failed'}\n- Diagnosis cause: ${diagnosis.likelyCause}\n- Required verification: \`${verification.requiredCommand}\`\n\n${verification.reason ?? 'Independent verification passed.'}\n`);
  return { status, diagnosis, verification, reason: verification.reason };
}
