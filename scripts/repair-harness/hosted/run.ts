import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HostedConfig } from './config';
import { probeDeployment, type HostedProbeResult } from './probes';
import { runHostedBrowserSmoke, runHostedMutation, type HostedAccount, type HostedBrowserSmokeResult, type HostedMutationResult } from './browser';
import { chromium, type Page } from '@playwright/test';
import { assertHostedMutationAllowed } from './browser';
import { projectHostedIsolationResult, runHostedIsolation, type HostedIsolationResult } from './isolation';
import type { HostedIsolationAccounts } from './accounts';
import { appendEvent, writeState } from '../state';
import { redactSecrets } from '../artifacts';

export interface HostedProbeRun { runId: string; runDirectory: string; results: HostedProbeResult[]; status: 'passed' | 'failed'; }

export async function runHostedProbe(options: { repo: string; config: HostedConfig; runId?: string; fetchImpl?: (input: string, init?: RequestInit) => Promise<Response> }): Promise<HostedProbeRun> {
  const runId = options.runId ?? `hosted-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(path.join(runDirectory, 'hosted-browser'), { recursive: true });
  const results = await probeDeployment(options.config, options.fetchImpl);
  const failed = results.filter((result) => result.failureClass);
  writeFileSync(path.join(runDirectory, 'hosted-config.json'), `${JSON.stringify({ ...options.config, expectedDevCommit: options.config.expectedDevCommit ? '[configured]' : undefined, expectedStableCommit: options.config.expectedStableCommit ? '[configured]' : undefined }, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'hosted-evidence.json'), `${redactSecrets(JSON.stringify({ version: 1, kind: 'hosted-deployment-probe', runId, status: failed.length ? 'failed' : 'passed', results }, null, 2))}\n`);
  writeFileSync(path.join(runDirectory, 'hosted-events.jsonl'), results.map((result) => `${JSON.stringify({ event: 'hosted-probe', endpoint: result.endpoint, status: result.failureClass ? 'failed' : 'passed', failureClass: result.failureClass, durationMs: result.durationMs, reason: result.reason })}\n`).join(''));
  const probeStatus = failed.length ? 'failed' : 'passed';
  const probeReasons = results.map((result) => result.reason).filter((reason): reason is string => Boolean(reason)).map(redactSecrets);
  writeFileSync(path.join(runDirectory, 'hosted-summary.md'), `# Hosted deployment probe\n\nStatus: ${probeStatus}\n\n${results.map((result) => `- ${result.endpoint}: ${result.failureClass ?? 'passed'} (${result.durationMs}ms)`).join('\n')}\n\nNext diagnostic: ${nextHostedDiagnostic(probeStatus)}\n`);
  writeHostedRunContracts(runDirectory, runId, probeStatus, probeReasons);
  return { runId, runDirectory, results, status: failed.length ? 'failed' : 'passed' };
}

export interface HostedBrowserRun { runId: string; runDirectory: string; result: HostedBrowserSmokeResult; status: HostedBrowserSmokeResult['status']; }

export interface HostedIsolationRun { runId: string; runDirectory: string; result: HostedIsolationResult; status: HostedIsolationResult['status']; }

export async function runHostedBrowser(options: { repo: string; config: HostedConfig; runId?: string }): Promise<HostedBrowserRun> {
  const runId = options.runId ?? `hosted-browser-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(path.join(runDirectory, 'hosted-browser'), { recursive: true });
  const result = await runHostedBrowserSmoke({ config: options.config });
  writeHostedBrowserArtifacts(runDirectory, options.config, runId, result);
  return { runId, runDirectory, result, status: result.status };
}

export function writeHostedBrowserArtifacts(runDirectory: string, config: HostedConfig, runId: string, result: HostedBrowserSmokeResult | HostedMutationResult | HostedIsolationResult): void {
  writeFileSync(path.join(runDirectory, 'hosted-config.json'), `${JSON.stringify({ ...config, expectedDevCommit: config.expectedDevCommit ? '[configured]' : undefined, expectedStableCommit: config.expectedStableCommit ? '[configured]' : undefined }, null, 2)}\n`);
  const evidenceResult = 'dev' in result && 'stable' in result ? projectHostedIsolationResult(result) : result;
  writeFileSync(path.join(runDirectory, 'hosted-evidence.json'), `${redactSecrets(JSON.stringify({ version: 1, kind: 'hosted-browser-validation', runId, status: result.status, result: evidenceResult }, null, 2))}\n`);
  writeFileSync(path.join(runDirectory, 'hosted-events.jsonl'), `${JSON.stringify({
    event: 'hosted-browser',
    status: result.status,
    runId,
    ...('cleanupConfirmed' in result && 'projectName' in result ? {
      projectName: result.projectName,
      createdProjectId: result.createdProjectId,
      cleanupConfirmed: result.cleanupConfirmed,
      cleanupStatus: result.createdProjectId ? (result.cleanupConfirmed ? 'confirmed' : 'cleanup-required') : 'not-needed',
      updatedProjectFoundAfterReload: result.updatedProjectFoundAfterReload,
      security: result.security,
    } : 'cleanupConfirmed' in result ? {
      isolation: projectHostedIsolationResult(result),
    } : {}),
  })}\n`);
  const reasons = 'reasons' in result ? result.reasons : [];
  const safeReasons = reasons.map(redactSecrets);
  writeFileSync(path.join(runDirectory, 'hosted-summary.md'), `# Hosted browser validation\n\nStatus: ${result.status}\n\n${safeReasons.map((reason) => `- ${reason}`).join('\n')}\n\nNext diagnostic: ${nextHostedDiagnostic(result.status)}\n`);
  writeHostedRunContracts(runDirectory, runId, result.status, safeReasons);
}

export function writeHostedRunContracts(runDirectory: string, runId: string, status: string, reasons: string[]): void {
  writeState(runDirectory, { runId, phase: 'hosted-validation', status, budgets: { modelCalls: 0, implementationAttempts: 0 }, scope: 'hosted', updatedAt: new Date().toISOString() });
  appendEvent(runDirectory, { event: 'hosted-validation-completed', status, scope: 'hosted', reasonCount: reasons.length });
  writeFileSync(path.join(runDirectory, 'hosted-metrics.json'), `${JSON.stringify({ status, reasonCount: reasons.length, failed: status !== 'passed', cleanupRequired: status === 'cleanup-required' }, null, 2)}\n`);
}

function nextHostedDiagnostic(status: string): string {
  if (status === 'cleanup-required') return 'Stop remote mutations and inspect the cleanup result before another run.';
  if (status === 'failed') return 'Run the read-only hosted-probe and inspect the redacted hosted evidence.';
  return 'No further hosted diagnostic is required.';
}

export async function runHostedIsolationCommand(options: { repo: string; config: HostedConfig; runId?: string; accounts: HostedIsolationAccounts; explicitFlag: boolean }): Promise<HostedIsolationRun> {
  assertHostedMutationAllowed(options.config, options.explicitFlag);
  const runId = options.runId ?? `hosted-isolation-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(path.join(runDirectory, 'hosted-browser'), { recursive: true });
  const result = await runHostedIsolation({ config: options.config, runId, accounts: options.accounts });
  writeHostedBrowserArtifacts(runDirectory, options.config, runId, result);
  return { runId, runDirectory, result, status: result.status };
}

export async function runHostedMutationWithPage(options: { repo: string; config: HostedConfig; runId: string; page: Page; account: HostedAccount; signup?: boolean; explicitFlag: boolean }): Promise<HostedMutationResult> {
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', options.runId);
  mkdirSync(path.join(runDirectory, 'hosted-browser'), { recursive: true });
  const result = await runHostedMutation(options);
  writeHostedBrowserArtifacts(runDirectory, options.config, options.runId, result);
  return result;
}

export async function runHostedMutationCommand(options: { repo: string; config: HostedConfig; runId?: string; account: HostedAccount; signup?: boolean; explicitFlag: boolean }): Promise<{ runId: string; runDirectory: string; result: HostedMutationResult }> {
  assertHostedMutationAllowed(options.config, options.explicitFlag);
  const runId = options.runId ?? `hosted-mutation-${Date.now()}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const result = await runHostedMutationWithPage({ ...options, runId, page: await context.newPage() });
    return { runId, runDirectory: path.resolve(options.repo, '.repair-harness', 'runs', runId), result };
  } finally {
    await context.close();
    await browser.close();
  }
}
