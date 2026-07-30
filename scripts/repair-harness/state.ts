import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { redactSecrets } from './artifacts';

export interface RepairState { runId: string; phase: string; status: string; budgets: Record<string, number>; scope?: string; updatedAt: string; }
export interface RepairEvent { event: string; at: string; [key: string]: unknown; }

export function cleanRunLogs(repo: string): void {
  const runsRoot = path.resolve(repo, '.repair-harness', 'runs');
  if (!existsSync(runsRoot)) return;

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith('.log')) unlinkSync(entryPath);
    }
  };

  visit(runsRoot);
}

export function cleanAllHarnessFiles(repo: string): void {
  const harnessRoot = path.resolve(repo, '.repair-harness');
  if (!existsSync(harnessRoot)) return;

  const runsRoot = path.join(harnessRoot, 'runs');
  if (existsSync(runsRoot)) rmSync(runsRoot, { recursive: true, force: true });

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) unlinkSync(entryPath);
    }
  };

  visit(harnessRoot);
}

export function createRun(repo: string, runId = `${Date.now()}`): { directory: string; state: RepairState } {
  const directory = path.resolve(repo, '.repair-harness', 'runs', runId);
  mkdirSync(directory, { recursive: true });
  const state: RepairState = { runId, phase: 'created', status: 'active', budgets: { modelCalls: 0, implementationAttempts: 0 }, updatedAt: new Date().toISOString() };
  writeState(directory, state);
  return { directory, state };
}

export function writeState(directory: string, state: RepairState): void { writeFileSync(path.join(directory, 'state.json'), `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`); }
export function readState(directory: string): RepairState { return JSON.parse(readFileSync(path.join(directory, 'state.json'), 'utf8')) as RepairState; }
export function appendEvent(directory: string, event: Omit<RepairEvent, 'at'>): void {
  const safe = Object.fromEntries(Object.entries(event).map(([key, value]) => [key, typeof value === 'string' ? redactSecrets(value) : value]));
  appendFileSync(path.join(directory, 'events.jsonl'), `${JSON.stringify({ ...safe, at: new Date().toISOString() })}\n`);
}
export function resolveResumeDirectory(repo: string, runId: string): string { return path.resolve(repo, '.repair-harness', 'runs', runId); }
