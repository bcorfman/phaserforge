import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';

import { formatWorkflowCatalog, getWorkflowCatalog, validateWorkflowCatalog } from './workflowCatalog';
import { collectEvidence } from './collect';
import { expectedEvidenceFingerprint, reproduce } from './reproduce';
import { verify } from './verify';
import { runBoundedRepair } from './repair';
import { appendEvent, cleanAllHarnessFiles, cleanRunLogs, readState, resolveResumeDirectory, writeState } from './state';
import type { EvidenceEnvelope } from './types';
import { aggregateRepairOutcomes, formatRepairMetrics, readRepairOutcomes, writeRepairMetrics } from './metrics';
import { loadHostedConfig } from './hosted/config';
import { runHostedBrowser, runHostedIsolationCommand, runHostedMutationCommand, runHostedProbe } from './hosted/run';
import { runE2ETiming } from './e2eTimingRun';
import { runAutomatedTimingRepair } from './timingRepair';
import { runHostedOAuthPreflight } from './hosted/oauth';
import { assertHostedScope, assertRepairCannotUseHostedScope } from './scope';

const repositoryRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);

const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
};

const has = (name: string): boolean => args.includes(name);
const cleanIfRequested = (repo: string): void => {
  if (has('--clean-all')) cleanAllHarnessFiles(repo);
  else if (has('--clean')) cleanRunLogs(repo);
};
const prepareHosted = (command: string): boolean => {
  assertHostedScope(command, value('--scope'));
  if (value('--agent')) throw new Error('Hosted validation cannot invoke an agent; use --no-agent.');
  return has('--dry-run');
};

function assertKnownE2ETimingRepairArguments(): void {
  const known = new Set(['--pr', '--run', '--repo', '--publish', '--max-iterations', '--model', '--reasoning', '--allow-timing-config', '--clean', '--clean-all']);
  for (const argument of args.slice(1)) {
    if (!argument.startsWith('--')) continue;
    const name = argument.includes('=') ? argument.slice(0, argument.indexOf('=')) : argument;
    if (!known.has(name)) throw new Error(`Unknown e2e-timing-repair option: ${name}. Did you mean --max-iterations?`);
  }
}

async function main(): Promise<void> {
if (args[0] === 'e2e-timing') {
  try {
    const reportPath = value('--report');
    if (!reportPath) throw new Error('Expected --report <playwright-report.json|index.html> for e2e-timing.');
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = runE2ETiming({ repo, reportPath: path.resolve(reportPath), runId: value('--run-id') });
    console.log(`E2E timing ${result.analysis.status} in ${result.runDirectory}`);
    if (result.analysis.status === 'failed' || result.analysis.status === 'invalid') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'e2e-timing-repair') {
  try {
    assertKnownE2ETimingRepairArguments();
    if (!value('--pr') && !value('--run')) throw new Error('Expected --pr <number> or --run <run-id> for e2e-timing-repair.');
    const requestedReasoning = value('--reasoning') ?? 'medium';
    const reasoning = requestedReasoning === 'extra-high' ? 'xhigh' : requestedReasoning;
    if (!['low', 'medium', 'high', 'xhigh'].includes(reasoning)) throw new Error('--reasoning must be low, medium, high, or extra-high (xhigh is also accepted).');
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = await runAutomatedTimingRepair({
      repo,
      pr: value('--pr'),
      run: value('--run'),
      agent: 'codex',
      publish: has('--publish'),
      maxIterations: Number(value('--max-iterations') ?? 3),
      model: value('--model'),
      reasoningEffort: reasoning as import('./agent').ReasoningEffort,
      allowTimingConfig: has('--allow-timing-config'),
    });
    console.log(`E2E timing repair ${result.status} in ${result.runDirectory}${result.reason ? `: ${result.reason}` : ''}`);
    if (result.pullRequestUrl) console.log(`Pull request: ${result.pullRequestUrl}`);
    if (result.status === 'failed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'hosted-probe') {
  try {
    const dryRun = prepareHosted('hosted-probe');
    const configPath = value('--config');
    if (!configPath) throw new Error('Expected --config <path> for hosted-probe.');
    const config = loadHostedConfig(path.resolve(configPath));
    if (dryRun) { console.log('Hosted probe dry-run: configuration validated; no network request will run.'); return; }
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = await runHostedProbe({ repo, config, runId: value('--run-id') });
    console.log(`Hosted probe ${result.status} in ${result.runDirectory}`);
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'hosted-browser') {
  try {
    const dryRun = prepareHosted('hosted-browser');
    const configPath = value('--config');
    if (!configPath) throw new Error('Expected --config <path> for hosted-browser.');
    const config = loadHostedConfig(path.resolve(configPath));
    if (dryRun) { console.log('Hosted browser dry-run: configuration validated; no browser or network request will run.'); return; }
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = await runHostedBrowser({ repo, config, runId: value('--run-id') });
    console.log(`Hosted browser ${result.status} in ${result.runDirectory}`);
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'hosted-mutate') {
  try {
    const dryRun = prepareHosted('hosted-mutate');
    const configPath = value('--config');
    const email = value('--email');
    const password = value('--password');
    if (!configPath) throw new Error('Expected --config <path> for hosted-mutate.');
    if (!email || !password) throw new Error('Hosted mutation requires --email and --password; credentials are used in memory only.');
    const config = loadHostedConfig(path.resolve(configPath));
    if (dryRun) { console.log('Hosted mutation dry-run: configuration and credentials presence validated; no browser or mutation will run.'); return; }
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = await runHostedMutationCommand({
      repo,
      config,
      runId: value('--run-id'),
      account: { email, password, inviteToken: value('--invite-token') },
      signup: has('--signup'),
      explicitFlag: has('--allow-hosted-mutations'),
    });
    console.log(`Hosted mutation ${result.result.status} in ${result.runDirectory}`);
    if (result.result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'hosted-isolation') {
  try {
    const dryRun = prepareHosted('hosted-isolation');
    const configPath = value('--config');
    const devEmail = value('--dev-email');
    const devPassword = value('--dev-password');
    const stableEmail = value('--stable-email');
    const stablePassword = value('--stable-password');
    if (!configPath) throw new Error('Expected --config <path> for hosted-isolation.');
    if (!devEmail || !devPassword || !stableEmail || !stablePassword) throw new Error('Hosted isolation requires separate --dev-email/--dev-password and --stable-email/--stable-password credentials; credentials are used in memory only.');
    const config = loadHostedConfig(path.resolve(configPath));
    if (dryRun) { console.log('Hosted isolation dry-run: configuration and credential presence validated; no browser or mutation will run.'); return; }
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = await runHostedIsolationCommand({
      repo,
      config,
      runId: value('--run-id'),
      accounts: { dev: { email: devEmail, password: devPassword }, stable: { email: stableEmail, password: stablePassword } },
      explicitFlag: has('--allow-hosted-mutations'),
    });
    console.log(`Hosted isolation ${result.status} in ${result.runDirectory}`);
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'hosted-oauth-preflight') {
  try {
    const dryRun = prepareHosted('hosted-oauth-preflight');
    const configPath = value('--config');
    if (!configPath) throw new Error('Expected --config <path> for hosted-oauth-preflight.');
    const config = loadHostedConfig(path.resolve(configPath));
    const result = runHostedOAuthPreflight(config, has('--allow-hosted-oauth'));
    console.log(`Hosted OAuth preflight ${result.status}${dryRun ? ' (dry-run)' : ''}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'metrics') {
  try {
    const repo = value('--repo') ?? repositoryRoot;
    const runsRoot = value('--runs-root') ?? path.join(repo, '.repair-harness', 'runs');
    const runDirectories = readdirSync(runsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(runsRoot, entry.name));
    const outcomes = runDirectories.flatMap(readRepairOutcomes);
    const metrics = aggregateRepairOutcomes(outcomes);
    if (!has('--dry-run')) writeRepairMetrics(runsRoot, outcomes);
    console.log(formatRepairMetrics(metrics));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (args[0] === 'collect') {
  try {
    const repo = value('--repo') ?? repositoryRoot;
    cleanIfRequested(repo);
    const result = collectEvidence({ repo, pr: value('--pr'), run: value('--run'), job: value('--job'), outputRoot: value('--output-root') });
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
    assertRepairCannotUseHostedScope(value('--scope'));
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
