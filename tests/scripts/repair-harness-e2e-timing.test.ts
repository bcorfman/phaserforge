import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { analyzeE2ETiming, parsePlaywrightJsonReport, type PlaywrightJsonReport } from '../../scripts/repair-harness/e2eTiming';
import { runE2ETiming } from '../../scripts/repair-harness/e2eTimingRun';

const report: PlaywrightJsonReport = {
  suites: [{
    title: 'editor',
    file: 'tests/e2e/editor.spec.ts',
    specs: [
      { title: 'fast test', tests: [{ projectName: 'chromium', results: [{ retry: 0, duration: 6_500, status: 'passed' }] }] },
      { title: 'involved test', tests: [{ projectName: 'chromium', results: [{ retry: 1, duration: 8_000, status: 'passed' }] }] },
      { title: 'slow test', tests: [{ projectName: 'webkit', results: [{ retry: 0, duration: 10_001, status: 'failed' }] }] },
    ],
  }],
};

describe('repair harness E2E timing diagnostics', () => {
  it('classifies normal, involved-case warning, and hard-ceiling durations', () => {
    const result = analyzeE2ETiming(report);
    expect(result.status).toBe('failed');
    expect(result.entries.map((entry) => entry.category)).toEqual(['normal', 'warning', 'slow']);
    expect(result.entries[1]).toMatchObject({ title: 'involved test', retry: 1, durationMs: 8_000, project: 'chromium' });
    expect(result.slowest).toMatchObject({ title: 'slow test', durationMs: 10_001 });
  });

  it('groups summary data by project and file without retaining raw report fields', () => {
    const result = analyzeE2ETiming(report);
    expect(result.groups).toEqual([{ project: 'chromium', file: 'tests/e2e/editor.spec.ts', count: 2, slowCount: 0, warningCount: 1, fastestMs: 6_500, slowestMs: 8_000 }, { project: 'webkit', file: 'tests/e2e/editor.spec.ts', count: 1, slowCount: 1, warningCount: 0, fastestMs: 10_001, slowestMs: 10_001 }]);
    expect(JSON.stringify(result)).not.toContain('attachments');
  });

  it('reports missing and invalid durations explicitly', () => {
    const result = analyzeE2ETiming({ suites: [{ title: 'bad', specs: [{ title: 'missing', tests: [{ projectName: 'chromium', results: [{ retry: 0, status: 'passed' }] }] }, { title: 'invalid', tests: [{ projectName: 'chromium', results: [{ retry: 0, duration: -1, status: 'passed' }] }] }] }] });
    expect(result.status).toBe('invalid');
    expect(result.entries.map((entry) => entry.category)).toEqual(['missing-duration', 'invalid-duration']);
  });

  it('rejects malformed reports and handles duplicate retry attempts independently', () => {
    expect(() => parsePlaywrightJsonReport({})).toThrow('suites');
    const result = analyzeE2ETiming({ suites: [{ title: 'suite', specs: [{ title: 'retrying', tests: [{ projectName: 'chromium', results: [{ retry: 0, duration: 7_001, status: 'failed' }, { retry: 1, duration: 6_999, status: 'passed' }] }] }] }] });
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.retry)).toEqual([0, 1]);
    expect(result.status).toBe('warning');
  });

  it('writes normalized evidence, events, and a summary without raw report fields', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-e2e-timing-'));
    const reportPath = path.join(repo, 'report.json');
    const raw = { ...report, suites: [{ ...report.suites[0], specs: [{ ...report.suites[0].specs![2], tests: [{ ...report.suites[0].specs![2].tests![0], results: [{ retry: 0, duration: 10_001, status: 'failed', attachments: [{ path: '/secret/raw.zip' }] }] }] }] }] };
    writeFileSync(reportPath, JSON.stringify(raw));
    const result = runE2ETiming({ repo, reportPath, runId: 'timing-test' });
    expect(result.analysis.status).toBe('failed');
    const evidence = readFileSync(path.join(result.runDirectory, 'e2e-timing-evidence.json'), 'utf8');
    expect(evidence).toContain('e2e-timing-diagnostic');
    expect(evidence).not.toContain('raw.zip');
    expect(readFileSync(path.join(result.runDirectory, 'e2e-timing-summary.md'), 'utf8')).toContain('10001ms');
  });
});
