import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { analyzeE2ETiming, type E2ETimingAnalysis } from './e2eTiming';

export interface E2ETimingRun { runId: string; runDirectory: string; analysis: E2ETimingAnalysis; }

export function runE2ETiming(options: { repo: string; reportPath: string; runId?: string }): E2ETimingRun {
  const runId = options.runId ?? `e2e-timing-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(runDirectory, { recursive: true });
  const analysis = analyzeE2ETiming(JSON.parse(readFileSync(options.reportPath, 'utf8')));
  writeFileSync(path.join(runDirectory, 'e2e-timing-evidence.json'), `${JSON.stringify({ version: 1, kind: 'e2e-timing-diagnostic', reportPath: path.relative(options.repo, options.reportPath), ...analysis }, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'e2e-timing-events.jsonl'), analysis.entries.map((entry) => `${JSON.stringify({ event: 'e2e-test-timing', title: entry.title, project: entry.project, file: entry.file, retry: entry.retry, durationMs: entry.durationMs, outcome: entry.outcome, category: entry.category })}\n`).join(''));
  writeFileSync(path.join(runDirectory, 'e2e-timing-summary.md'), renderSummary(analysis));
  return { runId, runDirectory, analysis };
}

function renderSummary(analysis: E2ETimingAnalysis): string {
  const lines = [
    '# E2E timing diagnostic',
    '',
    `Status: ${analysis.status}`,
    `Target: ${analysis.targetMs}ms; hard ceiling: ${analysis.hardCeilingMs}ms`,
    '',
    `Normal: ${analysis.counts.normal}; warnings: ${analysis.counts.warning}; slow: ${analysis.counts.slow}; invalid: ${analysis.counts['missing-duration'] + analysis.counts['invalid-duration']}`,
    '',
    '## Slow and warning tests',
    '',
    ...analysis.entries.filter((entry) => entry.category !== 'normal').map((entry) => `- ${entry.category}: ${entry.title} — ${entry.project} — ${entry.file} — ${entry.durationMs ?? 'missing'}ms (retry ${entry.retry})`),
  ];
  return `${lines.join('\n')}\n`;
}
