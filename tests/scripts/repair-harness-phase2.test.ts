import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { focusedReproductionCommand, reproduce } from '../../scripts/repair-harness/reproduce';
import { evaluatePolicy, stagnationReasons } from '../../scripts/repair-harness/policy';
import { appendEvent, cleanAllHarnessFiles, cleanRunLogs, createRun, readState, writeState } from '../../scripts/repair-harness/state';
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

  it('requires a timing-clean Playwright JSON report for timing repairs', async () => {
    const commands: string[] = [];
    const timingEvidence: EvidenceEnvelope = {
      ...evidence,
      scope: 'e2e-timing-repair',
      failure: { ...evidence.failure },
    };
    const result = await verify({ evidence: timingEvidence, cwd: process.cwd(), run: async (command) => {
      commands.push(command);
      return {
        command,
        cwd: process.cwd(),
        stdout: `\n> test:e2e\n\n${JSON.stringify({ suites: [{ file: 'tests/e2e/editor.spec.ts', specs: [{ title: 'slow but passing test', tests: [{ projectName: 'webkit', results: [{ retry: 0, duration: 10_001, status: 'passed' }] }] }] }] })}`,
        stderr: '', durationMs: 1, exitCode: 0, signal: null, timedOut: false, status: 'passed', evidenceFingerprint: 'ok',
      };
    } });

    expect(commands).toEqual([`${timingEvidence.reproduction.command} --reporter=json`]);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('hard ceiling');
  });
});

describe('repair harness phase 2 policy and state', () => {
  it('cleans log files recursively without removing run evidence', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-repair-clean-'));
    const runsRoot = path.join(repo, '.repair-harness', 'runs');
    mkdirSync(path.join(runsRoot, 'old', 'reproduce'), { recursive: true });
    writeFileSync(path.join(runsRoot, 'old', 'reproduce', 'stdout.log'), 'old output');
    writeFileSync(path.join(runsRoot, 'old', 'reproduce', 'stderr.log'), 'old error');
    writeFileSync(path.join(runsRoot, 'old', 'evidence.json'), '{}');

    cleanRunLogs(repo);

    expect(existsSync(path.join(runsRoot, 'old', 'reproduce', 'stdout.log'))).toBe(false);
    expect(existsSync(path.join(runsRoot, 'old', 'reproduce', 'stderr.log'))).toBe(false);
    expect(existsSync(path.join(runsRoot, 'old', 'evidence.json'))).toBe(true);
  });

  it('clean-all removes every harness file, including evidence and state', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-repair-clean-all-'));
    const harnessRoot = path.join(repo, '.repair-harness');
    mkdirSync(path.join(harnessRoot, 'runs', 'old', 'reproduce'), { recursive: true });
    writeFileSync(path.join(harnessRoot, 'runs', 'old', 'reproduce', 'stdout.log'), 'old output');
    writeFileSync(path.join(harnessRoot, 'runs', 'old', 'evidence.json'), '{}');
    writeFileSync(path.join(harnessRoot, 'runs', 'old', 'state.json'), '{}');
    writeFileSync(path.join(harnessRoot, 'metrics.json'), '{}');

    cleanAllHarnessFiles(repo);

    expect(existsSync(path.join(harnessRoot, 'runs', 'old', 'reproduce', 'stdout.log'))).toBe(false);
    expect(existsSync(path.join(harnessRoot, 'runs', 'old', 'evidence.json'))).toBe(false);
    expect(existsSync(path.join(harnessRoot, 'runs', 'old', 'state.json'))).toBe(false);
    expect(existsSync(path.join(harnessRoot, 'metrics.json'))).toBe(false);
    expect(existsSync(path.join(harnessRoot, 'runs'))).toBe(false);
  });

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
