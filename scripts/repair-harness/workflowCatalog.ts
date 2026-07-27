import { readFileSync } from 'node:fs';
import path from 'node:path';

export type RepairScope =
  | 'pr-e2e-chromium'
  | 'main-e2e-chromium'
  | 'nightly-e2e-full-matrix'
  | 'unit-node'
  | 'unit-jsdom'
  | 'storybook'
  | 'build'
  | 'docs-build'
  | 'deploy-frontend-pages'
  | 'deploy-backend-railway';

export interface WorkflowCatalogEntry {
  scope: RepairScope;
  supported: boolean;
  workflowFile: string;
  job: string;
  sourceCommands: string[];
  reproductionCommand?: string;
  requiredVerification?: string;
}

export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
}

const WORKFLOW_CATALOG: WorkflowCatalogEntry[] = [
  {
    scope: 'pr-e2e-chromium', supported: true, workflowFile: '.github/workflows/e2e-pr.yml', job: 'e2e-pr-chromium',
    sourceCommands: ['npm run test:e2e -- --project=chromium --grep "@smoke|@critical" --shard=${{ matrix.shard }}/${{ matrix.shards }} --fail-on-flaky-tests'],
    reproductionCommand: 'npm run test:e2e -- --project=chromium --grep "@smoke|@critical" --shard={shard}/{shards} --fail-on-flaky-tests',
    requiredVerification: 'npm run test:e2e -- --project=chromium --grep "@smoke|@critical" --shard={shard}/{shards} --fail-on-flaky-tests',
  },
  {
    scope: 'main-e2e-chromium', supported: false, workflowFile: '.github/workflows/e2e-main.yml', job: 'e2e-main-chromium',
    sourceCommands: ['node scripts/run-main-e2e-shard.cjs ${{ matrix.shard }} -- --fail-on-flaky-tests'],
  },
  {
    scope: 'nightly-e2e-full-matrix', supported: false, workflowFile: '.github/workflows/e2e-nightly-full-matrix.yml', job: 'e2e-nightly-full-matrix',
    sourceCommands: ['npm run test:e2e -- --project=firefox --project=webkit --project=msedge --shard=${{ matrix.shard }}/${{ matrix.shards }} --fail-on-flaky-tests'],
  },
  {
    scope: 'unit-node', supported: true, workflowFile: '.github/workflows/ci-build-test.yml', job: 'unit-tests-node',
    sourceCommands: ['npm run test:unit:node'], reproductionCommand: 'npm run test:unit:node', requiredVerification: 'npm run test:unit:node',
  },
  {
    scope: 'unit-jsdom', supported: true, workflowFile: '.github/workflows/ci-build-test.yml', job: 'unit-tests-jsdom',
    sourceCommands: ['npm run test:unit:jsdom'], reproductionCommand: 'npm run test:unit:jsdom', requiredVerification: 'npm run test:unit:jsdom',
  },
  {
    scope: 'storybook', supported: true, workflowFile: '.github/workflows/ci-build-test.yml', job: 'storybook-tests',
    sourceCommands: ['npm run test:stories'], reproductionCommand: 'npm run test:stories', requiredVerification: 'npm run test:stories',
  },
  {
    scope: 'build', supported: true, workflowFile: '.github/workflows/ci-build-test.yml', job: 'build-test',
    sourceCommands: ['npm run build'], reproductionCommand: 'npm run build', requiredVerification: 'npm run build',
  },
  {
    scope: 'docs-build', supported: false, workflowFile: '.github/workflows/docs-build.yml', job: 'build',
    sourceCommands: ['npm run docs:build'],
  },
  {
    scope: 'deploy-frontend-pages', supported: false, workflowFile: '.github/workflows/deploy-frontend-pages.yml', job: 'deploy',
    sourceCommands: ['npm run build -- --outDir dist/dev', 'npm run build -- --outDir dist/stable'],
  },
  {
    scope: 'deploy-backend-railway', supported: false, workflowFile: '.github/workflows/deploy-backend-railway.yml', job: 'deploy',
    sourceCommands: ['railway up'],
  },
];

function normalizeCommand(command: string): string {
  return command.replace(/\\[ \t]*\n/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export function extractWorkflowRunCommands(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const commands: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const singleLine = line.match(/^\s*-?\s*run:\s*(?!\||>)(.*)$/);
    if (singleLine && !['|', '>'].includes(singleLine[1].trim())) {
      commands.push(singleLine[1].trim());
      continue;
    }
    if (!/^\s*-?\s*run:\s*[|>]\s*-?\s*$/.test(line)) continue;
    const baseIndent = line.search(/\S/);
    const block: string[] = [];
    for (index += 1; index < lines.length; index += 1) {
      const blockLine = lines[index];
      if (blockLine.trim() && blockLine.search(/\S/) <= baseIndent) {
        index -= 1;
        break;
      }
      block.push(blockLine.replace(/\s+$/, ''));
    }
    while (block.length && !block[0].trim()) block.shift();
    while (block.length && !block[block.length - 1].trim()) block.pop();
    const contentIndent = Math.min(...block.filter((item) => item.trim()).map((item) => item.search(/\S/)));
    commands.push(block.map((item) => item.slice(Math.min(item.length, contentIndent))).join('\n'));
  }
  return commands;
}

export function getWorkflowCatalog(): WorkflowCatalogEntry[] {
  return WORKFLOW_CATALOG.map((entry) => ({ ...entry, sourceCommands: [...entry.sourceCommands] }));
}

export function validateWorkflowCatalog(repositoryRoot: string, catalog: WorkflowCatalogEntry[] = getWorkflowCatalog()): CatalogValidationResult {
  const errors: string[] = [];
  const sources = new Map<string, string[]>();
  for (const entry of catalog) {
    if (!sources.has(entry.workflowFile)) {
      const source = readFileSync(path.join(repositoryRoot, entry.workflowFile), 'utf8');
      sources.set(entry.workflowFile, extractWorkflowRunCommands(source).map(normalizeCommand));
    }
    const commands = sources.get(entry.workflowFile)!;
    for (const expected of entry.sourceCommands) {
      const normalizedExpected = normalizeCommand(expected);
      if (!commands.some((command) => command === normalizedExpected || command.includes(normalizedExpected))) {
        errors.push(`${entry.scope}: missing workflow command "${expected}"`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function formatWorkflowCatalog(catalog: WorkflowCatalogEntry[] = getWorkflowCatalog()): string {
  return catalog.map((entry) => [
    `${entry.scope} [${entry.supported ? 'supported' : 'unsupported'}]`,
    `  workflow: ${entry.workflowFile}`,
    `  job: ${entry.job}`,
    `  source: ${entry.sourceCommands.join(' | ')}`,
    ...(entry.reproductionCommand ? [`  reproduce: ${entry.reproductionCommand}`] : []),
    ...(entry.requiredVerification ? [`  verify: ${entry.requiredVerification}`] : []),
  ].join('\n')).join('\n\n');
}
