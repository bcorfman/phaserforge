import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import { extractFailureSnippet, extractRunIdFromUrl, isFailingCheck, parseAvailableFields } from './ghHelpers';

export type JsonRecord = Record<string, unknown>;

export interface GhRunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runGh(args: string[], options: { cwd?: string; allowFailure?: boolean } = {}): GhRunResult {
  const result = spawnSync('gh', args, { cwd: options.cwd, encoding: 'utf8' });
  const normalized = { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  if (normalized.status !== 0 && !options.allowFailure) {
    throw new Error([normalized.stderr, normalized.stdout].filter(Boolean).join('\n').trim() || `gh ${args.join(' ')} failed`);
  }
  return normalized;
}

export function resolvePr(pr: string | undefined, repo: string): string {
  if (pr) return pr;
  const result = runGh(['pr', 'view', '--json', 'number'], { cwd: repo });
  const data = JSON.parse(result.stdout) as { number?: number };
  if (!data.number) throw new Error('Unable to resolve current branch PR.');
  return String(data.number);
}

export function fetchChecks(pr: string, repo: string): JsonRecord[] {
  const primaryFields = ['name', 'state', 'conclusion', 'detailsUrl', 'startedAt', 'completedAt'];
  let result = runGh(['pr', 'checks', pr, '--json', primaryFields.join(',')], { cwd: repo, allowFailure: true });
  if (result.status !== 0) {
    const availableFields = parseAvailableFields(`${result.stderr}\n${result.stdout}`);
    const fallbackFields = ['name', 'state', 'bucket', 'link', 'workflow', 'startedAt', 'completedAt'];
    const selectedFields = fallbackFields.filter((field) => availableFields.includes(field));
    if (selectedFields.length === 0) throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || 'gh pr checks failed');
    result = runGh(['pr', 'checks', pr, '--json', selectedFields.join(',')], { cwd: repo });
  }
  return JSON.parse(result.stdout) as JsonRecord[];
}

export interface ResolvedRun {
  metadata: JsonRecord;
  job: JsonRecord;
  log: string;
  artifacts: JsonRecord[];
}

function parseJson(value: string): JsonRecord {
  return JSON.parse(value) as JsonRecord;
}

export function resolveRun(runId: string, repo: string, jobName?: string): ResolvedRun {
  const metadataResult = runGh(['run', 'view', runId, '--json', 'name,workflowName,conclusion,status,url,event,headBranch,headSha,jobs'], { cwd: repo });
  const metadata = parseJson(metadataResult.stdout);
  const jobs = Array.isArray(metadata.jobs) ? metadata.jobs as JsonRecord[] : [];
  const candidates = jobs.filter((job) => !jobName || String(job.name ?? '').toLowerCase() === jobName.toLowerCase() || String(job.name ?? '').toLowerCase().includes(jobName.toLowerCase()));
  const job = candidates.find((item) => isFailingCheck(item)) ?? candidates[0] ?? { name: jobName ?? String(metadata.name ?? 'Actions run') };
  const jobId = job.databaseId ?? job.id;
  const logArgs = jobId ? ['run', 'view', runId, '--job', String(jobId), '--log'] : ['run', 'view', runId, '--log'];
  const logResult = runGh(logArgs, { cwd: repo, allowFailure: true });
  const artifactResult = runGh(['api', `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`, '--paginate'], { cwd: repo, allowFailure: true });
  let artifacts: JsonRecord[] = [];
  if (artifactResult.status === 0 && artifactResult.stdout.trim()) {
    try { artifacts = (parseJson(artifactResult.stdout).artifacts as JsonRecord[]) ?? []; } catch { artifacts = []; }
  }
  return { metadata, job, log: logResult.stdout || logResult.stderr || '', artifacts };
}

export function resolveRunFromPr(pr: string, repo: string, options: { allowPassingE2E?: boolean } = {}): { runId: string; check: JsonRecord } {
  const checks = fetchChecks(pr, repo);
  const check = checks.find(isFailingCheck) ?? (options.allowPassingE2E ? checks.find((item) => /e2e|playwright/i.test(String(item.name ?? ''))) : undefined);
  if (!check) throw new Error(`PR #${pr}: no failing GitHub Actions checks detected.`);
  const url = String(check.detailsUrl ?? check.link ?? '');
  const runId = extractRunIdFromUrl(url);
  if (!runId) throw new Error(`Unsupported external check: ${String(check.name ?? 'Unnamed check')}`);
  return { runId, check };
}

export function downloadRunArtifacts(runId: string, destination: string, repo: string): void {
  mkdirSync(destination, { recursive: true });
  runGh(['run', 'download', runId, '--dir', destination], { cwd: repo });
}

export { extractFailureSnippet, extractRunIdFromUrl, isFailingCheck, parseAvailableFields };
