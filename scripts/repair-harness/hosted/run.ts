import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HostedConfig } from './config';
import { probeDeployment, type HostedProbeResult } from './probes';

export interface HostedProbeRun { runId: string; runDirectory: string; results: HostedProbeResult[]; status: 'passed' | 'failed'; }

export async function runHostedProbe(options: { repo: string; config: HostedConfig; runId?: string; fetchImpl?: (input: string, init?: RequestInit) => Promise<Response> }): Promise<HostedProbeRun> {
  const runId = options.runId ?? `hosted-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(path.join(runDirectory, 'hosted-browser'), { recursive: true });
  const results = await probeDeployment(options.config, options.fetchImpl);
  const failed = results.filter((result) => result.failureClass);
  writeFileSync(path.join(runDirectory, 'hosted-config.json'), `${JSON.stringify({ ...options.config, expectedDevCommit: options.config.expectedDevCommit ? '[configured]' : undefined, expectedStableCommit: options.config.expectedStableCommit ? '[configured]' : undefined }, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'hosted-evidence.json'), `${JSON.stringify({ version: 1, kind: 'hosted-deployment-probe', runId, status: failed.length ? 'failed' : 'passed', results }, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'hosted-events.jsonl'), results.map((result) => `${JSON.stringify({ event: 'hosted-probe', endpoint: result.endpoint, status: result.failureClass ? 'failed' : 'passed', failureClass: result.failureClass, durationMs: result.durationMs, reason: result.reason })}\n`).join(''));
  writeFileSync(path.join(runDirectory, 'hosted-summary.md'), `# Hosted deployment probe\n\nStatus: ${failed.length ? 'failed' : 'passed'}\n\n${results.map((result) => `- ${result.endpoint}: ${result.failureClass ?? 'passed'} (${result.durationMs}ms)`).join('\n')}\n`);
  return { runId, runDirectory, results, status: failed.length ? 'failed' : 'passed' };
}
