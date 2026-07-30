import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { analyzeE2ETiming } from './repair-harness/e2eTiming';

const DEFAULT_MAX_P95_MS = 10_000;
const DEFAULT_REPETITIONS = 20;

export interface TimingBenchmarkResult {
  status: 'passed' | 'failed';
  samples: number;
  medianMs: number;
  p95Ms: number;
  maxP95Ms: number;
}

export interface TimingBenchmarkSummary extends TimingBenchmarkResult {
  groups: Array<TimingBenchmarkResult & { project: string; file: string; title: string }>;
}

export function evaluateTimingBenchmark(samples: number[], maxP95Ms = DEFAULT_MAX_P95_MS): TimingBenchmarkResult {
  if (samples.length < 3) throw new Error('Timing benchmark requires at least 3 successful samples.');
  if (!samples.every((sample) => Number.isFinite(sample) && sample >= 0)) throw new Error('Timing benchmark contains an invalid duration.');
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number): number => sorted[Math.ceil(fraction * sorted.length) - 1];
  const medianMs = percentile(0.5);
  const p95Ms = percentile(0.95);
  return { status: p95Ms > maxP95Ms ? 'failed' : 'passed', samples: sorted.length, medianMs, p95Ms, maxP95Ms };
}

export function evaluatePlaywrightTimingBenchmark(report: unknown, maxP95Ms = DEFAULT_MAX_P95_MS): TimingBenchmarkSummary {
  const groups = new Map<string, { project: string; file: string; title: string; samples: number[] }>();
  for (const entry of analyzeE2ETiming(report).entries) {
    if (entry.outcome !== 'passed' || entry.durationMs === undefined) continue;
    const key = `${entry.project}\u0000${entry.file}\u0000${entry.title}`;
    const group = groups.get(key) ?? { project: entry.project, file: entry.file, title: entry.title, samples: [] };
    group.samples.push(entry.durationMs);
    groups.set(key, group);
  }
  const evaluated = [...groups.values()].map((group) => ({ ...group, ...evaluateTimingBenchmark(group.samples, maxP95Ms) }));
  if (!evaluated.length) throw new Error('Timing benchmark did not contain successful Playwright samples.');
  const worst = [...evaluated].sort((left, right) => right.p95Ms - left.p95Ms)[0];
  return {
    status: evaluated.some((group) => group.status === 'failed') ? 'failed' : 'passed',
    samples: evaluated.reduce((total, group) => total + group.samples, 0),
    medianMs: worst.medianMs,
    p95Ms: worst.p95Ms,
    maxP95Ms,
    groups: evaluated.map(({ project, file, title, samples, ...result }) => ({ project, file, title, ...result })),
  };
}

function main(): void {
  const maxP95Ms = numberEnv('E2E_TIMING_MAX_P95_MS', DEFAULT_MAX_P95_MS);
  const repetitions = numberEnv('E2E_TIMING_REPETITIONS', DEFAULT_REPETITIONS);
  const reportPath = process.env.E2E_TIMING_REPORT ?? 'e2e-timing-benchmark-report.json';
  const specs = process.argv.slice(2);
  if (!specs.length) throw new Error('Pass one or more representative E2E specs to benchmark.');
  const command = ['run', 'test:e2e', '--', '--project=webkit', '--workers=1', `--repeat-each=${repetitions}`, '--reporter=json', ...specs];
  const run = spawnSync('npm', command, { encoding: 'utf8', env: { ...process.env, PW_PROJECTS: 'webkit', PW_WORKERS: '1' } });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const report = parseJsonReport(output);
  const playwrightReportDirectory = path.join(path.dirname(reportPath), 'playwright-report');
  mkdirSync(playwrightReportDirectory, { recursive: true });
  writeFileSync(path.join(playwrightReportDirectory, 'report.json'), `${JSON.stringify(report)}\n`);
  const result = evaluatePlaywrightTimingBenchmark(report, maxP95Ms);
  writeFileSync(reportPath, `${JSON.stringify({ version: 1, kind: 'e2e-timing-benchmark', command: `npm ${command.join(' ')}`, ...result }, null, 2)}\n`);
  console.log(`E2E timing benchmark ${result.status}: ${result.samples} samples; median ${result.medianMs}ms; p95 ${result.p95Ms}ms; ceiling ${result.maxP95Ms}ms.`);
  if (run.status !== 0 || result.status !== 'passed') process.exitCode = 1;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function parseJsonReport(output: string): unknown {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Playwright did not emit a JSON report.');
  return JSON.parse(output.slice(start, end + 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
