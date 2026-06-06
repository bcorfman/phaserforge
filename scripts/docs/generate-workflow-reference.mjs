import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateWorkflowReferenceMarkdown } from '../../src/docs/workflowReference.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const sourcePath = path.join(repoRoot, '.plans', 'editor-workflows-inventory.md');
const outputPath = path.join(repoRoot, 'docs', 'reference', 'editor-workflows.md');

const source = await readFile(sourcePath, 'utf8');
const generated = generateWorkflowReferenceMarkdown(source);

await writeFile(outputPath, generated, 'utf8');
