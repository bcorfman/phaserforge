import path from 'node:path';

import { formatWorkflowCatalog, getWorkflowCatalog, validateWorkflowCatalog } from './workflowCatalog';
import { collectEvidence } from './collect';

const repositoryRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);

if (args[0] === 'collect') {
  const value = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  try {
    const result = collectEvidence({ repo: value('--repo') ?? repositoryRoot, pr: value('--pr'), run: value('--run'), job: value('--job') });
    console.log(`Collected ${result.envelope.failure.class} evidence in ${result.runDirectory}`);
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
