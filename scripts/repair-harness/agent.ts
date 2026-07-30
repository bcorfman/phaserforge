import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { RepairDiagnosis } from './types';

export type AgentCallKind = 'diagnosis' | 'implementation';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export interface AgentOptions { kind: AgentCallKind; packet: string; cwd: string; timeoutMs?: number; command?: string; args?: string[]; model?: string; reasoningEffort?: ReasoningEffort; }
export interface AgentResult { kind: AgentCallKind; stdout: string; stderr: string; exitCode: number | null; durationMs: number; packetBytes: number; tokenUsage?: { input?: number; output?: number; total?: number }; }

/**
 * The adapter discovers Codex from PATH or the VS Code extension install. The
 * environment variables remain available for unusual installations. Packets
 * are passed on stdin and credentials are never read, created, or embedded.
 */
export function runAgent(options: AgentOptions): Promise<AgentResult> {
  const command = options.command ?? process.env.PHASERFORGE_CODEX_COMMAND ?? discoverCodexCommand();
  if (!command) return Promise.reject(new Error('Codex executable not found. Install Codex or add it to PATH.'));
  let configuredArgs: string[] = ['exec', '--sandbox', 'workspace-write'];
  if (options.args) configuredArgs = options.args;
  else if (process.env.PHASERFORGE_CODEX_ARGS) {
    try { configuredArgs = JSON.parse(process.env.PHASERFORGE_CODEX_ARGS) as string[]; } catch { return Promise.reject(new Error('PHASERFORGE_CODEX_ARGS must be a JSON string array.')); }
  }
  else {
    if (options.model) configuredArgs.push('--model', options.model);
    configuredArgs.push('--config', `model_reasoning_effort=${JSON.stringify(options.reasoningEffort ?? 'medium')}`);
  }
  const started = Date.now();
  const agentEnv = { ...process.env };
  for (const key of ['CODEX_CI', 'CODEX_THREAD_ID', 'CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'CODEX_HISTORY_ARCHIVE_ROOT', 'CODEX_HISTORY_HTML_BACKEND']) delete agentEnv[key];
  return new Promise((resolve, reject) => {
    const child = spawn(command, configuredArgs, { cwd: options.cwd, env: agentEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false;
    const finish = (result: AgentResult) => { if (!settled) { settled = true; resolve(result); } };
    const timer = options.timeoutMs === undefined ? undefined : setTimeout(() => child.kill('SIGTERM'), options.timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      if (timer) clearTimeout(timer);
      finish({ kind: options.kind, stdout, stderr, exitCode, durationMs: Date.now() - started, packetBytes: Buffer.byteLength(options.packet) });
    });
    child.stdin.end(options.packet);
  });
}

export function discoverCodexCommand(): string | undefined {
  const pathResult = spawnSync('which', ['codex'], { encoding: 'utf8' });
  const fromPath = pathResult.status === 0 ? pathResult.stdout.trim() : '';
  if (fromPath) return fromPath;
  const home = process.env.HOME;
  if (!home) return undefined;
  const extensions = path.join(home, '.vscode-server', 'extensions');
  if (!existsSync(extensions)) return undefined;
  for (const extension of readdirSync(extensions)) {
    if (!extension.startsWith('openai.chatgpt-')) continue;
    const binRoot = path.join(extensions, extension, 'bin');
    if (!existsSync(binRoot)) continue;
    for (const platform of readdirSync(binRoot)) {
      const candidate = path.join(binRoot, platform, 'codex');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function jsonResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{'); const end = fenced.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Diagnosis response did not contain a JSON object.');
  return JSON.parse(fenced.slice(start, end + 1));
}

export function parseDiagnosis(text: string): RepairDiagnosis {
  const value = jsonResponse(text) as Partial<RepairDiagnosis>;
  if (!value || typeof value.failureClass !== 'string' || typeof value.likelyCause !== 'string' || !Array.isArray(value.files) || !Array.isArray(value.symbols) || typeof value.reproductionCommand !== 'string' || typeof value.confidence !== 'number') {
    throw new Error('Diagnosis response does not match the required contract.');
  }
  if (value.confidence < 0 || value.confidence > 1) throw new Error('Diagnosis confidence must be between 0 and 1.');
  const rawFailureClass = value.failureClass.toLowerCase();
  const failureClass = rawFailureClass.includes('timing') || rawFailureClass.includes('performance') || rawFailureClass.includes('slow')
    ? 'timeout'
    : ({ performance: 'timeout', timing: 'timeout', 'slow-test': 'timeout' } as Record<string, string>)[rawFailureClass] ?? rawFailureClass;
  if (!['assertion', 'compile', 'timeout', 'browser-crash', 'infrastructure', 'unknown'].includes(failureClass)) throw new Error('Diagnosis failure class is unsupported.');
  return { failureClass: failureClass as RepairDiagnosis['failureClass'], likelyCause: value.likelyCause, files: value.files.filter((file): file is string => typeof file === 'string'), symbols: value.symbols.filter((symbol): symbol is string => typeof symbol === 'string'), reproductionCommand: value.reproductionCommand, confidence: value.confidence };
}
