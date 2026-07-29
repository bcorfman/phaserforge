import { redactSecrets } from './artifacts';

export const E2E_TIMING_TARGET_MS = 7_000;
export const E2E_TIMING_HARD_CEILING_MS = 10_000;

export type E2ETimingCategory = 'normal' | 'warning' | 'slow' | 'missing-duration' | 'invalid-duration';
export type E2ETimingStatus = 'passed' | 'warning' | 'failed' | 'invalid';

export interface PlaywrightJsonResult {
  retry?: number;
  workerIndex?: number;
  duration?: number;
  status?: string;
  [key: string]: unknown;
}

export interface PlaywrightJsonTest {
  projectName?: string;
  results?: PlaywrightJsonResult[];
  [key: string]: unknown;
}

export interface PlaywrightJsonSpec {
  title?: string;
  file?: string;
  tests?: PlaywrightJsonTest[];
  [key: string]: unknown;
}

export interface PlaywrightJsonSuite {
  title?: string;
  file?: string;
  specs?: PlaywrightJsonSpec[];
  suites?: PlaywrightJsonSuite[];
  [key: string]: unknown;
}

export interface PlaywrightJsonReport { suites: PlaywrightJsonSuite[]; [key: string]: unknown; }

export interface E2ETimingEntry {
  title: string;
  project: string;
  file: string;
  retry: number;
  workerIndex?: number;
  durationMs?: number;
  outcome: string;
  category: E2ETimingCategory;
}

export interface E2ETimingGroup {
  project: string;
  file: string;
  count: number;
  slowCount: number;
  warningCount: number;
  fastestMs: number | null;
  slowestMs: number | null;
}

export interface E2ETimingAnalysis {
  status: E2ETimingStatus;
  targetMs: number;
  hardCeilingMs: number;
  entries: E2ETimingEntry[];
  groups: E2ETimingGroup[];
  slowest?: E2ETimingEntry;
  counts: Record<E2ETimingCategory, number>;
}

export function parsePlaywrightJsonReport(value: unknown): PlaywrightJsonReport {
  if (!value || typeof value !== 'object') {
    throw new Error('Playwright JSON report must contain a suites array.');
  }
  const report = value as { suites?: unknown; files?: unknown };
  if (Array.isArray(report.suites)) return value as PlaywrightJsonReport;
  if (Array.isArray(report.files)) return normalizePlaywrightFilesReport(value as PlaywrightFilesReport);
  throw new Error('Playwright JSON report must contain a suites array.');
}

interface PlaywrightFilesReport { files: PlaywrightFile[]; [key: string]: unknown; }
interface PlaywrightFile { fileName?: string; tests?: PlaywrightFileTest[]; }
interface PlaywrightFileTest { title?: string; projectName?: string; duration?: number; outcome?: string; results?: PlaywrightJsonResult[]; }

function normalizePlaywrightFilesReport(report: PlaywrightFilesReport): PlaywrightJsonReport {
  return {
    suites: report.files.map((file) => ({
      file: safeText(file.fileName, '[unknown-file]'),
      specs: (file.tests ?? []).map((test) => ({
        title: test.title,
        tests: [{
          projectName: test.projectName,
          results: [{ ...(test.results?.[0] ?? {}), duration: test.duration, status: test.outcome }],
        }],
      })),
    })),
  };
}

export function analyzeE2ETiming(value: unknown): E2ETimingAnalysis {
  const report = parsePlaywrightJsonReport(value);
  const entries: E2ETimingEntry[] = [];
  for (const suite of report.suites) collectSuite(suite, undefined, entries);
  return summarizeE2ETiming(entries);
}

export function analyzeE2ETimingReports(values: unknown[]): E2ETimingAnalysis {
  const entries: E2ETimingEntry[] = [];
  for (const value of values) {
    const report = parsePlaywrightJsonReport(value);
    for (const suite of report.suites) collectSuite(suite, undefined, entries);
  }
  return summarizeE2ETiming(entries);
}

function summarizeE2ETiming(entries: E2ETimingEntry[]): E2ETimingAnalysis {
  const counts: Record<E2ETimingCategory, number> = { normal: 0, warning: 0, slow: 0, 'missing-duration': 0, 'invalid-duration': 0 };
  for (const entry of entries) counts[entry.category] += 1;
  const valid = entries.filter((entry): entry is E2ETimingEntry & { durationMs: number } => typeof entry.durationMs === 'number');
  const groups = new Map<string, E2ETimingGroup>();
  for (const entry of entries) {
    const key = `${entry.project}\u0000${entry.file}`;
    const group = groups.get(key) ?? { project: entry.project, file: entry.file, count: 0, slowCount: 0, warningCount: 0, fastestMs: null, slowestMs: null };
    group.count += 1;
    if (entry.category === 'slow') group.slowCount += 1;
    if (entry.category === 'warning') group.warningCount += 1;
    if (entry.durationMs !== undefined) {
      group.fastestMs = group.fastestMs === null ? entry.durationMs : Math.min(group.fastestMs, entry.durationMs);
      group.slowestMs = group.slowestMs === null ? entry.durationMs : Math.max(group.slowestMs, entry.durationMs);
    }
    groups.set(key, group);
  }
  const status: E2ETimingStatus = counts['missing-duration'] || counts['invalid-duration'] ? 'invalid' : counts.slow ? 'failed' : counts.warning ? 'warning' : 'passed';
  return { status, targetMs: E2E_TIMING_TARGET_MS, hardCeilingMs: E2E_TIMING_HARD_CEILING_MS, entries, groups: [...groups.values()], slowest: valid.sort((a, b) => b.durationMs - a.durationMs)[0], counts };
}

function collectSuite(suite: PlaywrightJsonSuite, inheritedFile: string | undefined, entries: E2ETimingEntry[]): void {
  const file = safeText(suite.file ?? inheritedFile, '[unknown-file]');
  for (const spec of suite.specs ?? []) {
    const specFile = safeText(spec.file ?? file, '[unknown-file]');
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      if (results.length === 0) addEntry(spec, test, undefined, specFile, entries);
      else for (const result of results) addEntry(spec, test, result, specFile, entries);
    }
  }
  for (const child of suite.suites ?? []) collectSuite(child, file, entries);
}

function addEntry(spec: PlaywrightJsonSpec, test: PlaywrightJsonTest, result: PlaywrightJsonResult | undefined, file: string, entries: E2ETimingEntry[]): void {
  const durationMs = result?.duration;
  const category: E2ETimingCategory = result === undefined || durationMs === undefined ? 'missing-duration' : typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0 ? 'invalid-duration' : durationMs > E2E_TIMING_HARD_CEILING_MS ? 'slow' : durationMs > E2E_TIMING_TARGET_MS ? 'warning' : 'normal';
  const retry = typeof result?.retry === 'number' && Number.isInteger(result.retry) && result.retry >= 0 ? result.retry : 0;
  const workerIndex = typeof result?.workerIndex === 'number' && Number.isInteger(result.workerIndex) ? result.workerIndex : undefined;
  entries.push({ title: safeText(spec.title, '[untitled-test]'), project: safeText(test.projectName, '[unknown-project]'), file, retry, workerIndex, durationMs: category === 'missing-duration' || category === 'invalid-duration' ? undefined : durationMs, outcome: safeText(result?.status, 'unknown'), category });
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return redactSecrets(value.trim()).slice(0, 500);
}
