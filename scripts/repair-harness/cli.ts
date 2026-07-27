import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { formatWorkflowCatalog, getWorkflowCatalog, validateWorkflowCatalog } from './workflowCatalog';
import { collectEvidence } from './collect';
import { expectedEvidenceFingerprint, reproduce } from './reproduce';
import { verify } from './verify';
import { runBoundedRepair } from './repair';
import { appendEvent, readState, resolveResumeDirectory, writeState } from './state';
import type { EvidenceEnvelope } from './types';

const repositoryRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);

const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
};

const has = (name: string): boolean => args.includes(name);

async function main(): Promise<void> {
if (args[0] === 'collect') {
  try {
    const result = collectEvidence({ repo: value('--repo') ?? repositoryRoot, pr: value('--pr'), run: value('--run'), job: value('--job'), outputRoot: value('--output-root') });
    console.log(`Collected ${result.envelope.failure.class} evidence in ${result.runDirectory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'reproduce' || args[0] === 'verify') {
  try {
    const repo = value('--repo') ?? repositoryRoot;
    const runDirectory = value('--run-dir') ?? (value('--resume') ? resolveResumeDirectory(repo, value('--resume')!) : undefined);
    if (!runDirectory) throw new Error('Expected --run-dir or --resume <run-id>.');
    const state = readState(runDirectory);
    const evidence = JSON.parse(readFileSync(path.join(runDirectory, 'evidence.json'), 'utf8')) as EvidenceEnvelope;
    if (has('--dry-run')) {
      console.log(`${args[0] === 'reproduce' ? 'Reproduction' : 'Verification'} command: ${evidence.reproduction.command}`);
    } else if (args[0] === 'reproduce') {
      const result = await reproduce({ command: evidence.reproduction.command, cwd: repo, timeoutMs: Number(value('--timeout-ms') ?? 20 * 60 * 1000) });
      const reproduceDirectory = path.join(runDirectory, 'reproduce');
      mkdirSync(reproduceDirectory, { recursive: true });
      writeFileSync(path.join(reproduceDirectory, 'stdout.log'), result.stdout);
      writeFileSync(path.join(reproduceDirectory, 'stderr.log'), result.stderr);
      writeFileSync(path.join(reproduceDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      appendEvent(runDirectory, { event: 'reproduction-completed', status: result.status, evidenceFingerprint: result.evidenceFingerprint });
      const matches = result.status === 'failed' && result.evidenceFingerprint === expectedEvidenceFingerprint(evidence);
      const reproductionStatus = result.status === 'failed' && !matches ? 'mismatch' : result.status;
      writeState(runDirectory, { ...state, phase: 'reproduce', status: reproductionStatus });
      console.log(`Reproduction ${reproductionStatus}: ${result.durationMs}ms`);
      if (reproductionStatus !== 'failed') process.exitCode = 1;
    } else {
      const result = await verify({ evidence, cwd: repo, timeoutMs: Number(value('--timeout-ms') ?? 20 * 60 * 1000) });
      const verificationDirectory = path.join(runDirectory, 'verification');
      mkdirSync(verificationDirectory, { recursive: true });
      writeFileSync(path.join(verificationDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      appendEvent(runDirectory, { event: 'verification-completed', verified: result.verified, reason: result.reason ?? '' });
      writeState(runDirectory, { ...state, phase: 'verify', status: result.verified ? 'verified' : 'failed' });
      console.log(`Verification ${result.verified ? 'verified' : 'failed'}.`);
      if (!result.verified) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'repair') {
  try {
    if (has('--no-agent') || value('--agent') !== 'codex') throw new Error('Repair requires explicit --agent=codex; no agent is enabled by default.');
    const repo = value('--repo') ?? repositoryRoot;
    const runDirectory = value('--run-dir') ?? (value('--resume') ? resolveResumeDirectory(repo, value('--resume')!) : undefined);
    if (!runDirectory) throw new Error('Expected --run-dir or --resume <run-id>.');
    const evidence = JSON.parse(readFileSync(path.join(runDirectory, 'evidence.json'), 'utf8')) as EvidenceEnvelope;
    if (has('--dry-run')) {
      console.log(`Repair packets will be created for ${evidence.failure.class} evidence; no agent call will run.`);
    } else {
      const result = await runBoundedRepair({ repo, runDirectory, evidence });
      console.log(`Repair ${result.status}${result.reason ? `: ${result.reason}` : '.'}`);
      if (result.status !== 'verified') process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
const validation = validateWorkflowCatalog(repositoryRoot);

if (!validation.valid) {
  console.error(validation.errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(formatWorkflowCatalog(getWorkflowCatalog()));
}
}

}

void main();
