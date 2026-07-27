import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

import type { EvidenceEnvelope } from './types';

export type ReproductionStatus = 'passed' | 'failed' | 'timed-out' | 'spawn-error';

export interface ReproductionOptions {
  command: string;
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface ReproductionResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  status: ReproductionStatus;
  evidenceFingerprint: string;
}

export function evidenceFingerprint(value: string): string {
  const meaningful = value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /error|fail|assert|expect|timeout|exception|panic|received|expected/i.test(line))
    .slice(0, 20)
    .join('\n') || value.trim().split(/\r?\n/).slice(-20).join('\n');
  return createHash('sha256').update(meaningful.replace(/\d+(?:\.\d+)?s\b/g, '<duration>')).digest('hex').slice(0, 16);
}

export function expectedEvidenceFingerprint(evidence: EvidenceEnvelope): string {
  return evidence.failure.fingerprint ?? evidenceFingerprint(`${evidence.failure.message}\n${evidence.failure.stackExcerpt}`);
}

export function reproduce(options: ReproductionOptions): Promise<ReproductionResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(options.command, { cwd: options.cwd, env: { ...process.env, ...options.env }, shell: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null, status: ReproductionStatus) => {
      if (settled) return;
      settled = true;
      resolve({ command: options.command, cwd: options.cwd, stdout, stderr, durationMs: Date.now() - started,
        exitCode, signal, timedOut, status, evidenceFingerprint: evidenceFingerprint(`${stdout}\n${stderr}`) });
    };
    child.stdout?.on('data', (chunk: Buffer | string) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk: Buffer | string) => { stderr += String(chunk); });
    const timer = options.timeoutMs === undefined ? undefined : setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);
    child.once('error', (error) => { stderr += `${error.message}\n`; if (timer) clearTimeout(timer); finish(null, null, 'spawn-error'); });
    child.once('close', (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      finish(exitCode, signal, timedOut ? 'timed-out' : exitCode === 0 ? 'passed' : 'failed');
    });
  });
}

export function focusedReproductionCommand(evidence: EvidenceEnvelope): string {
  const command = evidence.reproduction.command;
  if (!evidence.failure.testFile || evidence.scope !== 'pr-e2e-chromium') return command;
  const title = evidence.failure.testTitle ? ` --grep ${JSON.stringify(evidence.failure.testTitle)}` : '';
  return `${command}${title} ${evidence.failure.testFile}`;
}
