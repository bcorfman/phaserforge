import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getWorkflowCatalog } from './workflowCatalog';
import { extractArtifactMetadata, redactSecrets } from './artifacts';
import { resolvePr, resolveRun, resolveRunFromPr } from './github';
import { extractFailure } from './triage';
import type { EvidenceEnvelope } from './types';

export interface CollectionOptions {
  repo: string;
  pr?: string;
  run?: string;
  job?: string;
  outputRoot?: string;
}

function chooseScope(workflow: string, job: string): string {
  const key = `${workflow} ${job}`.toLowerCase();
  if (key.includes('e2e pr') || key.includes('pr chromium')) return 'pr-e2e-chromium';
  if (key.includes('unit') && key.includes('node')) return 'unit-node';
  if (key.includes('unit') && key.includes('jsdom')) return 'unit-jsdom';
  if (key.includes('storybook')) return 'storybook';
  if (key.includes('build')) return 'build';
  return 'unknown';
}

function commandFor(scope: string, job: string): string {
  const entry = getWorkflowCatalog().find((item) => item.scope === scope);
  const shard = job.match(/shard\s+(\d+)\s*\/\s*(\d+)/i);
  return (entry?.reproductionCommand ?? '').replace('{shard}', shard?.[1] ?? '1').replace('{shards}', shard?.[2] ?? '2');
}

export function collectEvidence(options: CollectionOptions): { envelope: EvidenceEnvelope; runDirectory: string } {
  const pr = options.pr ? resolvePr(options.pr, options.repo) : undefined;
  const resolved = options.run ? { runId: options.run, check: undefined } : resolveRunFromPr(pr!, options.repo);
  const run = resolveRun(resolved.runId, options.repo, options.job ?? (resolved.check ? String(resolved.check.name ?? '') : undefined));
  const workflow = String(run.metadata.workflowName ?? run.metadata.name ?? 'Unknown workflow');
  const job = String(run.job.name ?? options.job ?? 'Unknown job');
  const scope = chooseScope(workflow, job);
  const rawLog = redactSecrets(run.log);
  const failure = extractFailure(rawLog);
  const knownPaths = rawLog.match(/(?:playwright-report|test-results)[/\\][^\s)]+/g) ?? [];
  const artifacts = extractArtifactMetadata([...knownPaths, ...run.artifacts.map((artifact) => `artifacts/${String(artifact.name ?? '')}`)]);
  const envelope: EvidenceEnvelope = {
    workflow: redactSecrets(workflow),
    job: redactSecrets(job),
    runId: resolved.runId,
    commit: String(run.metadata.headSha ?? ''),
    scope,
    reproduction: { command: commandFor(scope, job) || 'unsupported' },
    failure,
    artifacts,
    redactionsApplied: ['authorization', 'token', 'password', 'secret', 'cookie', 'credentialed URLs'],
  };
  const runDirectory = path.resolve(options.repo, options.outputRoot ?? '.repair-harness/runs', `${Date.now()}-${resolved.runId}`);
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(path.join(runDirectory, 'evidence.json'), `${JSON.stringify(envelope, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'summary.md'), [
    `# CI failure collection`, '',
    `- Workflow: ${envelope.workflow}`,
    `- Job: ${envelope.job}`,
    `- Run: ${envelope.runId}`,
    `- Scope: ${envelope.scope}`,
    `- Failure class: ${envelope.failure.class}`,
    `- Reproduction: \`${envelope.reproduction.command}\``,
    '', envelope.failure.stackExcerpt,
  ].join('\n') + '\n');
  return { envelope, runDirectory };
}
