import type { EvidenceEnvelope } from './types';
import { analyzeE2ETiming, type E2ETimingAnalysis } from './e2eTiming';
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
  timing?: Pick<E2ETimingAnalysis, 'status' | 'counts' | 'slowest'>;
  reason?: string;
}

export async function verify(options: VerificationOptions): Promise<VerificationResult> {
  const run = options.run ?? ((command, cwd, timeoutMs) => reproduce({ command, cwd, timeoutMs }));
  const candidateFocusedCommand = options.evidence.failure.testFile ? focusedReproductionCommand(options.evidence) : undefined;
  const focusedCommand = candidateFocusedCommand === options.evidence.reproduction.command ? undefined : candidateFocusedCommand;
  let focused: ReproductionResult | undefined;
  if (focusedCommand) {
    focused = await run(focusedCommand, options.cwd, options.timeoutMs);
    if (focused.status !== 'passed') return { verified: false, focusedCommand, focused, requiredCommand: options.evidence.reproduction.command, reason: 'Focused verification failed.' };
  }
  const isTimingRepair = options.evidence.scope === 'e2e-timing-repair';
  const requiredCommand = isTimingRepair ? `${options.evidence.reproduction.command} --reporter=json` : options.evidence.reproduction.command;
  const required = await run(requiredCommand, options.cwd, options.timeoutMs);
  if (isTimingRepair && required.status === 'passed') {
    try {
      const analysis = analyzeE2ETiming(parseJsonReporterOutput(required.stdout));
      const timing = { status: analysis.status, counts: analysis.counts, slowest: analysis.slowest };
      if (analysis.status === 'failed' || analysis.status === 'invalid') {
        return { verified: false, focusedCommand, focused, requiredCommand, required: redactTimingReport(required), timing, reason: 'Timing verification still exceeds the hard ceiling or has invalid durations.' };
      }
      return { verified: true, focusedCommand, focused, requiredCommand, required: redactTimingReport(required), timing };
    } catch (error) {
      return { verified: false, focusedCommand, focused, requiredCommand, required: redactTimingReport(required), reason: `Timing verification did not produce a readable Playwright JSON report: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  return { verified: required.status === 'passed', focusedCommand, focused, requiredCommand, required,
    reason: required.status === 'passed' ? undefined : 'Required verification failed.' };
}

function parseJsonReporterOutput(stdout: string): unknown {
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error('JSON object not found in test output.');
  return JSON.parse(stdout.slice(start));
}

function redactTimingReport(result: ReproductionResult): ReproductionResult {
  return { ...result, stdout: '[Playwright JSON report omitted; normalized timing summary recorded instead.]', stderr: '' };
}

export function reproductionMatchesEvidence(result: ReproductionResult, evidence: EvidenceEnvelope): boolean {
  return result.status === 'failed' && result.evidenceFingerprint === expectedEvidenceFingerprint(evidence);
}
