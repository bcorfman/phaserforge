import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { downloadRunArtifacts, resolveRun, resolveRunFromPr, triggerGithubWorkflow, waitForCompletedGithubRun } from './github';
import { runE2ETiming } from './e2eTimingRun';
import { runBoundedRepair, type RepairResult } from './repair';
import { appendEvent, writeState } from './state';
import type { EvidenceEnvelope } from './types';
import type { ReasoningEffort } from './agent';

export interface AutomatedTimingOptions {
  repo: string;
  pr?: string;
  run?: string;
  agent: 'codex';
  publish: boolean;
  maxIterations: number;
  model?: string;
  reasoningEffort: ReasoningEffort;
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

const CONTROLLED_TIMING_WORKFLOW = 'e2e-timing-webkit.yml';
const BROAD_SLOW_GROUPS = 5;

export function classifyTimingRepairScope(analysis: ReturnType<typeof runE2ETiming>['analysis']): string | undefined {
  const slowGroups = analysis.groups.filter((group) => group.slowCount > 0);
  const projects = new Set(slowGroups.map((group) => group.project));
  if (slowGroups.length >= BROAD_SLOW_GROUPS || projects.size > 1) {
    return `The ${analysis.counts.slow} hard-ceiling results span ${slowGroups.length} project/file groups. This is broad CI timing telemetry, not a reproducible product-level regression; no source patch was attempted. Run the controlled WebKit timing workflow to establish a p95 regression before repair.`;
  }
  return undefined;
}

export async function runAutomatedTimingRepair(options: AutomatedTimingOptions): Promise<AutomatedTimingResult> {
  if (options.publish && execFileSync('git', ['status', '--porcelain'], { cwd: options.repo, encoding: 'utf8' }).trim()) {
    throw new Error('Refusing --publish with pre-existing working-tree changes; start from a clean checkout.');
  }
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) throw new Error('--max-iterations must be a positive integer.');
  const source = options.run ? { runId: options.run } : resolveRunFromPr(options.pr!, options.repo, { allowPassingE2E: true });
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', `timing-repair-${source.runId}-${Date.now()}`);
  const artifactDirectory = path.join(runDirectory, 'github-artifacts');
  mkdirSync(runDirectory, { recursive: true });
  downloadRunArtifacts(source.runId, artifactDirectory, options.repo);
  const timing = runE2ETiming({ repo: options.repo, reportPath: artifactDirectory, runId: path.basename(runDirectory) });
  let currentRunId = source.runId;
  let currentAnalysis = timing.analysis;
  let branch: string | undefined;
  let pullRequestUrl: string | undefined;
  let lastRepair: RepairResult | undefined;
  if (isTimingClean(currentAnalysis)) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: currentAnalysis.status, analysis: currentAnalysis };
  const scopeReason = classifyTimingRepairScope(currentAnalysis);
  if (scopeReason) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'stopped', analysis: currentAnalysis, reason: scopeReason };

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    const cycleDirectory = iteration === 1 ? timing.runDirectory : path.join(timing.runDirectory, `iteration-${iteration}`);
    mkdirSync(cycleDirectory, { recursive: true });
    const resolved = resolveRun(currentRunId, options.repo);
    const evidence = createTimingEvidence(currentRunId, resolved, currentAnalysis);
    writeFileSync(path.join(cycleDirectory, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    writeState(cycleDirectory, { runId: path.basename(cycleDirectory), phase: 'timing', status: 'active', budgets: { diagnosisCalls: 0, implementationAttempts: 0 }, scope: 'e2e-timing-repair', updatedAt: new Date().toISOString() });
    appendEvent(cycleDirectory, { event: 'github-matrix-downloaded', sourceRunId: currentRunId, slowTests: currentAnalysis.counts.slow, iteration });
    const repair = await runBoundedRepair({ repo: options.repo, runDirectory: cycleDirectory, evidence, allowTimingConfig: options.allowTimingConfig, model: options.model, reasoningEffort: options.reasoningEffort });
    lastRepair = repair;
    if (repair.status !== 'verified') return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: repair.status === 'stopped' ? 'stopped' : 'failed', analysis: currentAnalysis, repair, pullRequestUrl, reason: repair.reason };
    if (!options.publish) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'repaired', analysis: currentAnalysis, repair };

    if (!hasWorkingTreeChanges(options.repo)) {
      return {
        sourceRunId: source.runId,
        runDirectory: timing.runDirectory,
        status: 'stopped',
        analysis: currentAnalysis,
        repair,
        pullRequestUrl,
        reason: 'The focused timing verification passed without a source change. The original broad CI slowdown was not reproduced, so there is no patch to publish.',
      };
    }
    const published = publishRepair(options.repo, source.runId, branch);
    branch = published.branch;
    pullRequestUrl ??= published.url;
    triggerGithubWorkflow(options.repo, CONTROLLED_TIMING_WORKFLOW, branch);
    const completed = await waitForCompletedGithubRun({ repo: options.repo, branch, headSha: published.headSha, workflow: CONTROLLED_TIMING_WORKFLOW });
    const iterationDirectory = path.join(cycleDirectory, 'github');
    const iterationArtifacts = path.join(iterationDirectory, 'artifacts');
    mkdirSync(iterationDirectory, { recursive: true });
    downloadRunArtifacts(completed.runId, iterationArtifacts, options.repo);
    const refreshed = runE2ETiming({ repo: iterationDirectory, reportPath: iterationArtifacts, runId: 'timing' }).analysis;
    const benchmark = readTimingBenchmark(iterationArtifacts);
    appendEvent(cycleDirectory, { event: 'github-iteration-completed', runId: completed.runId, conclusion: completed.conclusion, slowTests: refreshed.counts.slow, iteration });
    if (completed.conclusion !== 'success') return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'failed', analysis: refreshed, repair, pullRequestUrl, reason: `GitHub iteration ${completed.runId} concluded ${completed.conclusion ?? 'without a conclusion'}.` };
    if (!benchmark) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'failed', analysis: refreshed, repair, pullRequestUrl, reason: `GitHub iteration ${completed.runId} did not upload its controlled timing benchmark.` };
    if (benchmark.status === 'passed') return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'published', analysis: refreshed, repair, pullRequestUrl };
    if (refreshed.counts.slow >= currentAnalysis.counts.slow) return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'failed', analysis: refreshed, repair, pullRequestUrl, reason: `GitHub iteration ${completed.runId} did not reduce the slow-test count.` };
    currentRunId = completed.runId;
    currentAnalysis = refreshed;
  }
  return { sourceRunId: source.runId, runDirectory: timing.runDirectory, status: 'failed', analysis: currentAnalysis, repair: lastRepair, pullRequestUrl, reason: `Timing repair exhausted its ${options.maxIterations}-iteration budget.` };
}

function isTimingClean(analysis: ReturnType<typeof runE2ETiming>['analysis']): boolean {
  return analysis.status === 'passed' || analysis.status === 'warning';
}

export function readTimingBenchmark(directory: string): { status: 'passed' | 'failed'; p95Ms: number; maxP95Ms: number } | undefined {
  const candidates: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.name === 'e2e-timing-benchmark-report.json') candidates.push(child);
    }
  };
  visit(directory);
  for (const candidate of candidates) {
    try {
      const data = JSON.parse(readFileSync(candidate, 'utf8')) as Record<string, unknown>;
      if (data.kind === 'e2e-timing-benchmark' && (data.status === 'passed' || data.status === 'failed') && typeof data.p95Ms === 'number' && typeof data.maxP95Ms === 'number') {
        return { status: data.status, p95Ms: data.p95Ms, maxP95Ms: data.maxP95Ms };
      }
    } catch { /* ignore malformed artifacts and continue searching */ }
  }
  return undefined;
}

function createTimingEvidence(runId: string, resolved: ReturnType<typeof resolveRun>, analysis: ReturnType<typeof runE2ETiming>['analysis']): EvidenceEnvelope {
  const slow = analysis.entries.filter((entry) => entry.category === 'slow');
  const first = slow[0];
  if (!first) throw new Error('Timing repair requires at least one slow test.');
  const job = String(resolved.job.name ?? resolved.metadata.workflowName ?? 'GitHub Actions E2E matrix');
  const command = commandForJob(job);
  return {
    workflow: String(resolved.metadata.workflowName ?? resolved.metadata.name ?? 'GitHub Actions'),
    job,
    runId,
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

function publishRepair(repo: string, sourceRunId: string, existingBranch?: string): { url: string; branch: string; headSha: string } {
  if (!hasWorkingTreeChanges(repo)) throw new Error('Verified timing repair produced no working-tree changes to publish.');
  const branch = existingBranch ?? `agent/e2e-timing-${sourceRunId}`;
  if (!existingBranch) execFileSync('git', ['switch', '-c', branch], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', 'Fix slow E2E test'], { cwd: repo, stdio: 'inherit' });
  execFileSync('git', ['push', '--set-upstream', 'origin', branch], { cwd: repo, stdio: 'inherit' });
  const url = existingBranch ? '' : execFileSync('gh', ['pr', 'create', '--draft', '--title', 'Fix slow E2E test', '--body', `Automated repair from GitHub Actions run ${sourceRunId}.\n\nTiming evidence and independent verification are recorded in the repair run.`], { cwd: repo, encoding: 'utf8' }).trim();
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  return { url, branch, headSha };
}

function hasWorkingTreeChanges(repo: string): boolean {
  return Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim());
}
