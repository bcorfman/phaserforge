import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { focusedReproductionCommand, reproduce } from '../../scripts/repair-harness/reproduce';
import { evaluatePolicy, stagnationReasons } from '../../scripts/repair-harness/policy';
import { appendEvent, createRun, readState, writeState } from '../../scripts/repair-harness/state';
import { reproductionMatchesEvidence, verify } from '../../scripts/repair-harness/verify';
import type { EvidenceEnvelope } from '../../scripts/repair-harness/types';

const evidence: EvidenceEnvelope = {
  workflow: 'PhaserForge CI / E2E (PR)', job: 'E2E PR Chromium (shard 1/2)', runId: '42', commit: 'abc', scope: 'pr-e2e-chromium',
  reproduction: { command: 'node -e "process.exit(1)"' },
  failure: { class: 'assertion', testFile: 'tests/e2e/editor.spec.ts', testTitle: 'saves a project', message: 'Error: expected', stackExcerpt: 'Error: expected' },
  artifacts: { tracePaths: [], screenshotPaths: [] }, redactionsApplied: [],
};

describe('repair harness phase 2 reproduction', () => {
  it('captures output, exit status, duration, and a stable fingerprint', async () => {
    const result = await reproduce({ command: 'node -e "console.error(\\\'Error: expected\\\'); process.exit(1)"', cwd: process.cwd() });
    expect(result).toMatchObject({ status: 'failed', exitCode: 1 });
    expect(result.stderr).toContain('Error: expected');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.evidenceFingerprint).toHaveLength(16);
  });

  it('reports a timeout and stops the child process', async () => {
    const result = await reproduce({ command: 'node -e "setTimeout(() => {}, 1000)"', cwd: process.cwd(), timeoutMs: 10 });
    expect(result.status).toBe('timed-out');
    expect(result.timedOut).toBe(true);
  });

  it('focuses a parsed Playwright failure while preserving the CI command', () => {
    expect(focusedReproductionCommand(evidence)).toContain('--grep "saves a project" tests/e2e/editor.spec.ts');
  });

  it('rejects a reproduction with a different failure fingerprint', () => {
    expect(reproductionMatchesEvidence({ command: '', cwd: '', stdout: '', stderr: '', durationMs: 1, exitCode: 1, signal: null, timedOut: false, status: 'failed', evidenceFingerprint: 'different' }, evidence)).toBe(false);
  });

  it('runs focused verification before required verification', async () => {
    const commands: string[] = [];
    const result = await verify({ evidence, cwd: process.cwd(), run: async (command) => {
      commands.push(command);
      return { command, cwd: process.cwd(), stdout: '', stderr: '', durationMs: 1, exitCode: 0, signal: null, timedOut: false, status: 'passed', evidenceFingerprint: 'ok' };
    } });
    expect(result.verified).toBe(true);
    expect(commands).toEqual([focusedReproductionCommand(evidence), evidence.reproduction.command]);
  });
});

describe('repair harness phase 2 policy and state', () => {
  it('denies unsafe test, workflow, config, and retry changes', () => {
    const result = evaluatePolicy([
      'M\t.github/workflows/e2e-pr.yml',
      'M\tplaywright.config.ts',
      '+ test.skip(\'flaky\')',
      '+ retries: 3',
    ].join('\n'));
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
  });

  it('detects repeated evidence and a patch with no allowed product file', () => {
    expect(stagnationReasons({ previousFingerprints: ['same'], currentFingerprint: 'same', changedFiles: ['.github/workflows/ci.yml'] })).toEqual([
      'Evidence fingerprint repeated.', 'No allowed product file changed.',
    ]);
  });

  it('persists resumable state and redacted JSONL events', () => {
    const { directory } = createRun(process.cwd(), `phase2-${Date.now()}`);
    const state = readState(directory);
    writeState(directory, { ...state, phase: 'reproduce' });
    appendEvent(directory, { event: 'command', command: 'token=secret npm test' });
    expect(readState(directory).phase).toBe('reproduce');
    expect(readFileSync(`${directory}/events.jsonl`, 'utf8')).not.toContain('secret');
  });
});
