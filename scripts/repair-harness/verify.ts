import type { EvidenceEnvelope } from './types';
import { expectedEvidenceFingerprint, focusedReproductionCommand, reproduce, type ReproductionResult } from './reproduce';

export interface VerificationOptions {
  evidence: EvidenceEnvelope;
  cwd: string;
  timeoutMs?: number;
  run?: (command: string, cwd: string, timeoutMs?: number) => Promise<ReproductionResult>;
}

export interface VerificationResult {
  verified: boolean;
  focusedCommand?: string;
  focused?: ReproductionResult;
  requiredCommand: string;
  required?: ReproductionResult;
  reason?: string;
}

export async function verify(options: VerificationOptions): Promise<VerificationResult> {
  const run = options.run ?? ((command, cwd, timeoutMs) => reproduce({ command, cwd, timeoutMs }));
  const focusedCommand = options.evidence.failure.testFile ? focusedReproductionCommand(options.evidence) : undefined;
  let focused: ReproductionResult | undefined;
  if (focusedCommand) {
    focused = await run(focusedCommand, options.cwd, options.timeoutMs);
    if (focused.status !== 'passed') return { verified: false, focusedCommand, focused, requiredCommand: options.evidence.reproduction.command, reason: 'Focused verification failed.' };
  }
  const requiredCommand = options.evidence.reproduction.command;
  const required = await run(requiredCommand, options.cwd, options.timeoutMs);
  return { verified: required.status === 'passed', focusedCommand, focused, requiredCommand, required,
    reason: required.status === 'passed' ? undefined : 'Required verification failed.' };
}

export function reproductionMatchesEvidence(result: ReproductionResult, evidence: EvidenceEnvelope): boolean {
  return result.status === 'failed' && result.evidenceFingerprint === expectedEvidenceFingerprint(evidence);
}
