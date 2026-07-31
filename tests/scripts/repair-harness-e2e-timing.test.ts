import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { analyzeE2ETiming, parsePlaywrightJsonReport, type PlaywrightJsonReport } from '../../scripts/repair-harness/e2eTiming';
import { runE2ETiming } from '../../scripts/repair-harness/e2eTimingRun';
import { applyFullMatrixSingleWorkerRepair, classifyTimingRepairScope, commandForJob, formatSlowTestEvidence, readTimingBenchmark, shouldRepairFullMatrixConcurrency } from '../../scripts/repair-harness/timingRepair';

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

  it('fails a hard-ceiling duration even when Playwright reports the test as passed', () => {
    const result = analyzeE2ETiming({
      suites: [{
        file: 'tests/e2e/editor.spec.ts',
        specs: [{ title: 'slow but passing test', tests: [{ projectName: 'webkit', results: [{ retry: 0, duration: 10_001, status: 'passed' }] }] }],
      }],
    });

    expect(result).toMatchObject({ status: 'failed', counts: { slow: 1 } });
  });

  it('retains every slow test in repair evidence', () => {
    const slow = Array.from({ length: 21 }, (_, index) => ({ title: `slow ${index + 1}`, project: 'webkit', file: `tests/e2e/slow-${index + 1}.spec.ts`, durationMs: 10_001 + index }));

    const evidence = formatSlowTestEvidence(slow);

    expect(evidence).toContain('21 tests exceeded the hard ceiling across 21 project/file groups.');
    expect(evidence).toContain('webkit — tests/e2e/slow-1.spec.ts — 1 slow (10001-10001ms)');
    expect(evidence).toContain('webkit — tests/e2e/slow-21.spec.ts — 1 slow (10021-10021ms)');
  });

  it('enables every browser named by a full-matrix reproduction command', () => {
    expect(commandForJob('E2E Full Matrix (shard 4/8)')).toContain('PW_PROJECTS=firefox,webkit,msedge');
  });

  it('runs the Full Matrix with one worker to prevent cross-browser WebKit contention', () => {
    const workflow = readFileSync('.github/workflows/e2e-nightly-full-matrix.yml', 'utf8');
    expect(workflow).toContain("PW_WORKERS: '1'");
    expect(workflow).toContain('shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]');
    expect(workflow).toContain('shards: [12]');
  });

  it('builds docs before the Full Matrix and marks them prebuilt for the docs E2E', () => {
    const workflow = readFileSync('.github/workflows/e2e-nightly-full-matrix.yml', 'utf8');
    const docsBuildIndex = workflow.indexOf('- name: Build docs for E2E');
    const e2eIndex = workflow.indexOf('- name: E2E Tests');

    expect(docsBuildIndex).toBeGreaterThan(-1);
    expect(docsBuildIndex).toBeLessThan(e2eIndex);
    expect(workflow).toContain('PHASERFORGE_DOCS_PREBUILT: \'1\'');
  });

  it('reproduces an isolated WebKit shard with one worker', () => {
    expect(commandForJob('E2E WebKit Isolation (shard 4/8)')).toBe('PW_PROJECTS=webkit PW_WORKERS=1 npm run test:e2e -- --project=webkit --shard=4/8 --fail-on-flaky-tests');
  });

  it('stops product repair for broad, cross-file CI timing telemetry', () => {
    const analysis = analyzeE2ETiming({
      suites: Array.from({ length: 5 }, (_, index) => ({
        file: `tests/e2e/slow-${index}.spec.ts`,
        specs: [{ title: `slow ${index}`, tests: [{ projectName: 'webkit', results: [{ duration: 10_001, status: 'passed' }] }] }],
      })),
    });

    expect(classifyTimingRepairScope(analysis)).toContain('broad CI timing telemetry');
  });

  it('recognizes a clean single-worker replay as a Full Matrix concurrency repair', () => {
    const broad = analyzeE2ETiming({
      suites: Array.from({ length: 5 }, (_, index) => ({ file: `tests/e2e/slow-${index}.spec.ts`, specs: [{ title: `slow ${index}`, tests: [{ projectName: 'webkit', results: [{ duration: 10_001, status: 'passed' }] }] }] })),
    });
    const isolated = analyzeE2ETiming({ suites: [{ file: 'tests/e2e/slow-0.spec.ts', specs: [{ title: 'stable when isolated', tests: [{ projectName: 'webkit', results: [{ duration: 4_000, status: 'passed' }] }] }] }] });

    expect(shouldRepairFullMatrixConcurrency(broad, isolated)).toBe(true);
  });

  it('adds a single-worker setting only to the Full Matrix workflow', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-full-matrix-repair-'));
    const workflow = path.join(repo, '.github', 'workflows', 'e2e-nightly-full-matrix.yml');
    mkdirSync(path.dirname(workflow), { recursive: true });
    writeFileSync(workflow, '      - name: E2E Tests\n        env:\n          PW_PROJECTS: firefox,webkit,msedge\n');

    expect(applyFullMatrixSingleWorkerRepair(repo)).toBe(true);
    expect(readFileSync(workflow, 'utf8')).toContain("PW_WORKERS: '1'");
    expect(applyFullMatrixSingleWorkerRepair(repo)).toBe(false);
  });

  it('reads the controlled timing benchmark from downloaded artifacts', () => {
    const artifacts = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-timing-benchmark-'));
    const benchmarkDirectory = path.join(artifacts, 'playwright-webkit-timing');
    mkdirSync(benchmarkDirectory, { recursive: true });
    writeFileSync(path.join(benchmarkDirectory, 'e2e-timing-benchmark-report.json'), JSON.stringify({ kind: 'e2e-timing-benchmark', status: 'passed', p95Ms: 4_400, maxP95Ms: 10_000 }));

    expect(readTimingBenchmark(artifacts)).toEqual({ status: 'passed', p95Ms: 4_400, maxP95Ms: 10_000 });
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

  it('accepts a Playwright HTML report with its embedded report.json', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-e2e-html-timing-'));
    const reportPath = path.join(repo, 'index.html');
    writeFileSync(reportPath, makePlaywrightHtmlReport({ ...report, suites: [{ ...report.suites[0], specs: [report.suites[0].specs![2]] }] }));

    const result = runE2ETiming({ repo, reportPath, runId: 'html-timing-test' });

    expect(result.analysis.status).toBe('failed');
    expect(result.analysis.entries).toMatchObject([{ title: 'slow test', durationMs: 10_001 }]);
  });

  it('merges every shard report when given an artifact directory', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-e2e-matrix-timing-'));
    const first = path.join(repo, 'shard-1', 'playwright-report');
    const second = path.join(repo, 'shard-2', 'playwright-report');
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    writeFileSync(path.join(first, 'index.html'), makePlaywrightHtmlReport(report));
    writeFileSync(path.join(second, 'index.html'), makePlaywrightHtmlReport({ ...report, suites: [{ ...report.suites[0], specs: [report.suites[0].specs![0]] }] }));

    const result = runE2ETiming({ repo, reportPath: repo, runId: 'matrix-timing-test' });

    expect(result.analysis.entries).toHaveLength(4);
  });

  it('ignores nested trace-viewer HTML files while discovering report roots', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-e2e-trace-timing-'));
    const reportRoot = path.join(repo, 'shard-1', 'playwright-report');
    mkdirSync(path.join(reportRoot, 'trace'), { recursive: true });
    writeFileSync(path.join(reportRoot, 'index.html'), makePlaywrightHtmlReport(report));
    writeFileSync(path.join(reportRoot, 'trace', 'index.html'), '<html>trace viewer</html>');

    const result = runE2ETiming({ repo, reportPath: repo, runId: 'trace-timing-test' });

    expect(result.analysis.entries).toHaveLength(3);
  });
});

function makePlaywrightHtmlReport(value: PlaywrightJsonReport): string {
  const filename = Buffer.from('report.json');
  const payload = Buffer.from(JSON.stringify(value));
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(payload.length, 22);
  localHeader.writeUInt16LE(filename.length, 26);
  const local = Buffer.concat([localHeader, filename, payload]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt32LE(payload.length, 20);
  centralHeader.writeUInt32LE(payload.length, 24);
  centralHeader.writeUInt16LE(filename.length, 28);
  centralHeader.writeUInt32LE(0, 42);
  const central = Buffer.concat([centralHeader, filename]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return `<html><template id="playwrightReportBase64">data:application/zip;base64,${Buffer.concat([local, central, end]).toString('base64')}</template></html>`;
}
