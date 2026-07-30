import { describe, expect, it } from 'vitest';

import { runAgent, parseDiagnosis } from '../../scripts/repair-harness/agent';
import { PHASE3_BUDGETS, budgetAllows } from '../../scripts/repair-harness/budget';
import { createDiagnosisPacket, createImplementationPacket } from '../../scripts/repair-harness/packet';
import { runBoundedRepair } from '../../scripts/repair-harness/repair';
import { createRun, readState, type RepairState } from '../../scripts/repair-harness/state';
import type { EvidenceEnvelope } from '../../scripts/repair-harness/types';

const evidence: EvidenceEnvelope = {
  workflow: 'PhaserForge CI / E2E (PR)', job: 'E2E PR Chromium (shard 1/2)', runId: 'phase3', commit: 'abc', scope: 'pr-e2e-chromium',
  reproduction: { command: 'npm run test:e2e -- --project=chromium --grep "@smoke" --shard=1/2 --fail-on-flaky-tests' },
  failure: { class: 'assertion', testFile: 'tests/e2e/editor.spec.ts', testTitle: 'saves a project', message: 'Error: expected', stackExcerpt: 'Error: expected' },
  artifacts: { tracePaths: [], screenshotPaths: [] }, redactionsApplied: [],
};

function agentResult(kind: 'diagnosis' | 'implementation', stdout: string, exitCode = 0) {
  return { kind, stdout, stderr: '', exitCode, durationMs: 1, packetBytes: 100 } as const;
}

describe('repair harness phase 3 packets and agent', () => {
  it('creates compact diagnosis and implementation packets without secrets', () => {
    const diagnosis = { failureClass: 'assertion' as const, likelyCause: 'state is not persisted', files: ['src/editor/store.ts'], symbols: ['saveProject'], reproductionCommand: evidence.reproduction.command, confidence: 0.8 };
    const diagnosisPacket = createDiagnosisPacket({ repo: process.cwd(), evidence, targetedFiles: diagnosis.files });
    const implementationPacket = createImplementationPacket({ repo: process.cwd(), evidence, diagnosis, diff: 'token=secret\n+safe change' });
    expect(diagnosisPacket).toContain('Return JSON only');
    expect(implementationPacket).toContain('Approved diagnosis');
    expect(implementationPacket).not.toContain('token=secret');
    expect(implementationPacket).toContain('[REDACTED]');
  });

  it('parses the strict diagnosis contract, including fenced JSON', () => {
    expect(parseDiagnosis('```json\n{"failureClass":"assertion","likelyCause":"bad state","files":["src/a.ts"],"symbols":["save"],"reproductionCommand":"npm test","confidence":0.7}\n```')).toMatchObject({ failureClass: 'assertion', confidence: 0.7 });
    expect(() => parseDiagnosis('{"failureClass":"assertion"}')).toThrow('required contract');
    expect(parseDiagnosis('{"failureClass":"performance","likelyCause":"slow browser setup","files":["tests/e2e/a.spec.ts"],"symbols":[],"reproductionCommand":"npm test","confidence":0.7}')).toMatchObject({ failureClass: 'timeout' });
    expect(parseDiagnosis('{"failureClass":"CI timing-threshold failure","likelyCause":"slow WebKit","files":["tests/e2e/a.spec.ts"],"symbols":[],"reproductionCommand":"npm test","confidence":0.7}')).toMatchObject({ failureClass: 'timeout' });
  });

  it('runs the opt-in adapter with a controlled local command', async () => {
    const result = await runAgent({ kind: 'diagnosis', packet: 'packet', cwd: process.cwd(), command: process.execPath, args: ['-e', "process.stdin.on('data',()=>process.stdout.write('ok'))"] });
    expect(result).toMatchObject({ kind: 'diagnosis', exitCode: 0, packetBytes: 6 });
    expect(result.stdout).toBe('ok');
  });
});

describe('repair harness phase 3 bounds and verification gate', () => {
  it('does not call an agent for infrastructure failures', async () => {
    const { directory } = createRun(process.cwd(), `phase3-infra-${Date.now()}`);
    const calls: string[] = [];
    const result = await runBoundedRepair({ repo: process.cwd(), runDirectory: directory, evidence: { ...evidence, failure: { ...evidence.failure, class: 'infrastructure' } }, callAgent: async (kind) => { calls.push(kind); return agentResult(kind, ''); } });
    expect(result).toMatchObject({ status: 'stopped' });
    expect(calls).toEqual([]);
  });

  it('requires independent verification before reporting verified', async () => {
    const { directory } = createRun(process.cwd(), `phase3-gate-${Date.now()}`);
    const calls: string[] = [];
    const diagnosis = JSON.stringify({ failureClass: 'assertion', likelyCause: 'bad state', files: ['src/editor/store.ts'], symbols: ['save'], reproductionCommand: evidence.reproduction.command, confidence: 0.9 });
    const result = await runBoundedRepair({ repo: process.cwd(), runDirectory: directory, evidence, diff: '', callAgent: async (kind) => { calls.push(kind); return agentResult(kind, kind === 'diagnosis' ? diagnosis : 'model says done'); }, verifyPatch: async () => ({ verified: false, requiredCommand: evidence.reproduction.command, reason: 'Required verification failed.' }) });
    expect(result.status).toBe('failed');
    expect(calls).toEqual(['diagnosis', 'implementation']);
    expect(readState(directory).status).toBe('failed');
  });

  it('stops when the diagnosis or implementation budget is exhausted', () => {
    const state: RepairState = { runId: 'x', phase: 'diagnosis', status: 'active', budgets: { diagnosisCalls: PHASE3_BUDGETS.diagnosisCalls }, updatedAt: new Date().toISOString() };
    expect(budgetAllows(state, 'diagnosis', 0, 10)).toBe(false);
    expect(budgetAllows(state, 'implementation', PHASE3_BUDGETS.wallTimeMs + 1, 10)).toBe(false);
  });
});
