import { extractFailureSnippet, extractRunIdFromUrl, isFailingCheck, parseAvailableFields } from './repair-harness/ghHelpers';
import { fetchChecks, resolvePr, runGh } from './repair-harness/github';

export { extractFailureSnippet, extractRunIdFromUrl, isFailingCheck, parseAvailableFields } from './repair-harness/ghHelpers';

type JsonRecord = Record<string, unknown>;

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
