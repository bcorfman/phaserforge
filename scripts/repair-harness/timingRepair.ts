import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { downloadRunArtifacts, resolveRun, resolveRunFromPr } from './github';
import { runE2ETiming } from './e2eTimingRun';
import { runBoundedRepair, type RepairResult } from './repair';
import { appendEvent, writeState } from './state';
import type { EvidenceEnvelope } from './types';

export interface AutomatedTimingOptions {
  repo: string;
  pr?: string;
  run?: string;
  agent: 'codex';
  publish: boolean;
  allowTimingConfig: boolean;
}

export interface AutomatedTimingResult {
  sourceRunId: string;
  runDirectory: string;
  status: 'passed' | 'warning' | 'stopped' | 'failed' | 'repaired' | 'published';
  reason?: string;
  analysis: ReturnType<typeof runE2ETiming>['analysis'];
  repair?: RepairResult;
  pullRequestUrl?: string;
}

export async function runAutomatedTimingRepair(options: AutomatedTimingOptions): Promise<AutomatedTimingResult> {
  if (options.publish && execFileSync('git', ['status', '--porcelain'], { cwd: options.repo, encoding: 'utf8' }).trim()) {
    throw new Error('Refusing --publish with pre-existing working-tree changes; start from a clean checkout.');
  }
  const source = options.run ? { runId: options.run } : resolveRunFromPr(options.pr!, options.repo, { allowPassingE2E: true });
  const resolved = resolveRun(source.runId, options.repo);
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', `timing-repair-${source.runId}-${Date.now()}`);
  const artifactDirectory = path.join(runDirectory, 'github-artifacts');
  mkdirSync(runDirectory, { recursive: true });
  downloadRunArtifacts(source.runId, artifactDirectory, options.repo);
  const timing = runE2ETiming({ repo: options.repo, reportPath: artifactDirectory, runId: path.basename(runDirectory) });
  const analysis = timing.analysis;
  if (analysis.status === 'warning' || analysis.status === 'passed') return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: analysis.status, analysis };

  const slow = analysis.entries.filter((entry) => entry.category === 'slow');
  const first = slow[0];
  const job = String(resolved.job.name ?? resolved.metadata.workflowName ?? 'GitHub Actions E2E matrix');
  const command = commandForJob(job);
  const evidence: EvidenceEnvelope = {
    workflow: String(resolved.metadata.workflowName ?? resolved.metadata.name ?? 'GitHub Actions'),
    job,
    runId: source.runId,
    commit: String(resolved.metadata.headSha ?? ''),
    scope: 'e2e-timing-repair',
    reproduction: { command },
    failure: {
      class: 'timeout',
      testFile: first.file,
      testTitle: first.title,
      message: formatSlowTestEvidence(slow),
      stackExcerpt: formatSlowTestEvidence(slow),
    },
    artifacts: { tracePaths: [], screenshotPaths: [] },
    redactionsApplied: ['GitHub artifact contents were reduced to timing fields'],
  };
  writeFileSync(path.join(timing.runDirectory, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  writeState(timing.runDirectory, { runId: path.basename(timing.runDirectory), phase: 'timing', status: 'active', budgets: { diagnosisCalls: 0, implementationAttempts: 0 }, scope: 'e2e-timing-repair', updatedAt: new Date().toISOString() });
  appendEvent(timing.runDirectory, { event: 'github-matrix-downloaded', sourceRunId: source.runId, slowTests: slow.length });
  if (!options.agent) throw new Error('Automated timing repair requires --agent=codex.');
  const repair = await runBoundedRepair({ repo: options.repo, runDirectory: timing.runDirectory, evidence, allowTimingConfig: options.allowTimingConfig });
  if (repair.status !== 'verified') return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: repair.status === 'stopped' ? 'stopped' : 'failed', analysis, repair, reason: repair.reason };
  if (!options.publish) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'repaired', analysis, repair };
  const pullRequestUrl = publishRepair(options.repo, source.runId);
  return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'published', analysis, repair, pullRequestUrl };
}

export function formatSlowTestEvidence(slow: Array<{ title: string; project: string; file: string; durationMs?: number }>): string {
  const groups = new Map<string, { project: string; file: string; count: number; fastestMs: number; slowestMs: number }>();
  for (const entry of slow) {
    const key = `${entry.project}\u0000${entry.file}`;
    const durationMs = entry.durationMs ?? 0;
    const group = groups.get(key) ?? { project: entry.project, file: entry.file, count: 0, fastestMs: durationMs, slowestMs: durationMs };
    group.count += 1;
    group.fastestMs = Math.min(group.fastestMs, durationMs);
    group.slowestMs = Math.max(group.slowestMs, durationMs);
    groups.set(key, group);
  }
  const inventory = [...groups.values()]
    .sort((left, right) => right.slowestMs - left.slowestMs)
    .map((group) => `- ${group.project} — ${group.file} — ${group.count} slow (${group.fastestMs}-${group.slowestMs}ms)`)
    .join('\n');
  return `${slow.length} tests exceeded the hard ceiling across ${groups.size} project/file groups. Full normalized test-level inventory is in e2e-timing-evidence.json.\n${inventory}`;
}

export function commandForJob(job: string): string {
  const shard = job.match(/shard\s+(\d+)\s*\/\s*(\d+)/i);
  if (/full matrix/i.test(job)) return 'PW_PROJECTS=firefox,webkit,msedge npm run test:e2e -- --project=firefox --project=webkit --project=msedge --shard={shard}/{shards} --fail-on-flaky-tests'.replace('{shard}', shard?.[1] ?? '1').replace('{shards}', shard?.[2] ?? '1');
  return 'npm run test:e2e -- --project=chromium --grep "@smoke|@critical" --shard={shard}/{shards} --fail-on-flaky-tests'.replace('{shard}', shard?.[1] ?? '1').replace('{shards}', shard?.[2] ?? '1');
}

function publishRepair(repo: string, sourceRunId: string): string {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  if (!status.trim()) throw new Error('Verified timing repair produced no working-tree changes to publish.');
  const branch = `agent/e2e-timing-${sourceRunId}`;
  execFileSync('git', ['switch', '-c', branch], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', 'Fix slow E2E test'], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['push', '--set-upstream', 'origin', branch], { cwd: repo, stdio: 'inherit' });
  return execFileSync('gh', ['pr', 'create', '--draft', '--title', 'Fix slow E2E test', '--body', `Automated repair from GitHub Actions run ${sourceRunId}.\n\nTiming evidence and independent verification are recorded in the repair run.`], { cwd: repo, encoding: 'utf8' }).trim();
}
