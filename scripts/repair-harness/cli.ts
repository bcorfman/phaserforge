import path from 'node:path';

import { formatWorkflowCatalog, getWorkflowCatalog, validateWorkflowCatalog } from './workflowCatalog';

const repositoryRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const validation = validateWorkflowCatalog(repositoryRoot);

if (!validation.valid) {
  console.error(validation.errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(formatWorkflowCatalog(getWorkflowCatalog()));
}
