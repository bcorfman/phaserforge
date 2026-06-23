import { spawnSync } from 'node:child_process';

type JsonRecord = Record<string, unknown>;

const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const FAILURE_STATES = new Set(['failure', 'error', 'cancelled', 'timed_out', 'action_required']);
const FAILURE_BUCKETS = new Set(['fail']);
const FAILURE_MARKERS = ['error', 'fail', 'failed', 'traceback', 'exception', 'assert', 'panic', 'fatal', 'timeout'];

export function parseAvailableFields(text: string): string[] {
  const match = text.match(/Available fields:\s*([\s\S]+)/i);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-zA-Z][\w-]*$/.test(line));
}

export function isFailingCheck(check: JsonRecord): boolean {
  const conclusion = String(check.conclusion ?? '').toLowerCase();
  if (FAILURE_CONCLUSIONS.has(conclusion)) return true;
  const state = String((check.state ?? check.status ?? '')).toLowerCase();
  if (FAILURE_STATES.has(state)) return true;
  const bucket = String(check.bucket ?? '').toLowerCase();
  return FAILURE_BUCKETS.has(bucket);
}

export function extractRunIdFromUrl(url: string): string | null {
  const match = url.match(/\/actions\/runs\/(\d+)/);
  return match?.[1] ?? null;
}

export function extractFailureSnippet(logText: string, maxLines = 120, context = 20): string {
  const lines = logText.split(/\r?\n/);
  const failureIndex = lines.findIndex((line) => {
    const normalized = line.toLowerCase();
    return FAILURE_MARKERS.some((marker) => normalized.includes(marker));
  });
  if (failureIndex < 0) {
    return lines.slice(-maxLines).join('\n').trim();
  }
  const start = Math.max(0, failureIndex - context);
  const end = Math.min(lines.length, start + maxLines);
  return lines.slice(start, end).join('\n').trim();
}

function runGh(args: string[], options: { cwd?: string; allowFailure?: boolean } = {}) {
  const result = spawnSync('gh', args, {
    cwd: options.cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0 && !options.allowFailure) {
    const message = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(message || `gh ${args.join(' ')} failed`);
  }
  return result;
}

function parseArgs(argv: string[]) {
  const parsed: { pr?: string; json: boolean; repo: string } = {
    json: false,
    repo: '.',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--pr') parsed.pr = argv[i + 1];
    else if (arg === '--repo') parsed.repo = argv[i + 1];
    if (arg === '--pr' || arg === '--repo') i += 1;
  }
  return parsed;
}

function resolvePr(pr: string | undefined, repo: string): string {
  if (pr) return pr;
  const result = runGh(['pr', 'view', '--json', 'number,url'], { cwd: repo });
  const data = JSON.parse(result.stdout) as { number?: number; url?: string };
  if (!data.number) throw new Error('Unable to resolve current branch PR.');
  return String(data.number);
}

function fetchChecks(pr: string, repo: string): JsonRecord[] {
  const primaryFields = ['name', 'state', 'conclusion', 'detailsUrl', 'startedAt', 'completedAt'];
  let result = runGh(['pr', 'checks', pr, '--json', primaryFields.join(',')], { cwd: repo, allowFailure: true });
  if (result.status !== 0) {
    const availableFields = parseAvailableFields(`${result.stderr}\n${result.stdout}`);
    const fallbackFields = ['name', 'state', 'bucket', 'link', 'workflow', 'startedAt', 'completedAt'];
    const selectedFields = fallbackFields.filter((field) => availableFields.includes(field));
    if (selectedFields.length === 0) {
      throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || 'gh pr checks failed');
    }
    result = runGh(['pr', 'checks', pr, '--json', selectedFields.join(',')], { cwd: repo });
  }
  return JSON.parse(result.stdout) as JsonRecord[];
}

function inspectRun(runId: string, repo: string) {
  const metadataResult = runGh(
    ['run', 'view', runId, '--json', 'name,workflowName,conclusion,status,url,event,headBranch,headSha'],
    { cwd: repo },
  );
  const metadata = JSON.parse(metadataResult.stdout) as JsonRecord;
  const logResult = runGh(['run', 'view', runId, '--log'], { cwd: repo, allowFailure: true });
  const logText = logResult.stdout || logResult.stderr || '';
  return {
    metadata,
    snippet: extractFailureSnippet(logText),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  runGh(['auth', 'status'], { cwd: args.repo });
  const pr = resolvePr(args.pr, args.repo);
  const checks = fetchChecks(pr, args.repo);
  const failingChecks = checks.filter(isFailingCheck);

  const results = failingChecks.map((check) => {
    const name = String(check.name ?? 'Unnamed check');
    const url = String(check.detailsUrl ?? check.link ?? '');
    const runId = extractRunIdFromUrl(url);
    if (!runId) {
      return {
        name,
        detailsUrl: url,
        provider: 'external',
      };
    }
    const run = inspectRun(runId, args.repo);
    return {
      name,
      detailsUrl: url,
      runId,
      ...run,
    };
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ pr, failingChecks: results }, null, 2)}\n`);
    process.exit(results.length > 0 ? 1 : 0);
  }

  if (results.length === 0) {
    process.stdout.write(`PR #${pr}: no failing GitHub Actions checks detected.\n`);
    return;
  }

  process.stdout.write(`PR #${pr}: failing checks\n\n`);
  for (const result of results) {
    process.stdout.write(`- ${result.name}\n`);
    if ('runId' in result) {
      process.stdout.write(`  Run: ${result.runId}\n`);
      process.stdout.write(`  URL: ${result.detailsUrl}\n`);
      process.stdout.write(`  Snippet:\n${String(result.snippet).split('\n').map((line) => `    ${line}`).join('\n')}\n\n`);
    } else {
      process.stdout.write(`  URL: ${result.detailsUrl || '(no URL)'}\n`);
      process.stdout.write('  Note: non-GitHub Actions check; inspect externally.\n\n');
    }
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
