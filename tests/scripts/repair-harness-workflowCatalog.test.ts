import { describe, expect, it } from 'vitest';

import {
  getWorkflowCatalog,
  extractWorkflowRunCommands,
  validateWorkflowCatalog,
} from '../../scripts/repair-harness/workflowCatalog';

describe('repair harness workflow catalog', () => {
  it('extracts single-line and block run commands from workflow YAML', () => {
    expect(extractWorkflowRunCommands(`
      steps:
        - run: npm run test:unit:node
        - run: |
            set -euo pipefail
            npm run build
            npm run pages:verify
    `)).toEqual([
      'npm run test:unit:node',
      'set -euo pipefail\nnpm run build\nnpm run pages:verify',
    ]);
  });

  it('describes every current CI workflow and enables only Phase 0 scopes', () => {
    const catalog = getWorkflowCatalog();

    expect(catalog.filter((entry) => entry.supported).map((entry) => entry.scope)).toEqual([
      'pr-e2e-chromium',
      'unit-node',
      'unit-jsdom',
      'storybook',
      'build',
    ]);
    expect(catalog.filter((entry) => !entry.supported).map((entry) => entry.scope)).toEqual([
      'main-e2e-chromium',
      'nightly-e2e-full-matrix',
      'docs-build',
      'deploy-frontend-pages',
      'deploy-backend-railway',
    ]);
  });

  it('validates catalog commands against the workflow sources', () => {
    expect(validateWorkflowCatalog('/home/bcorfman/dev/phaserforge')).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('reports command drift instead of silently accepting a stale catalog', () => {
    const catalog = getWorkflowCatalog().map((entry) => ({
      ...entry,
      sourceCommands: entry.scope === 'build' ? ['npm run build --stale'] : entry.sourceCommands,
    }));

    const result = validateWorkflowCatalog('/home/bcorfman/dev/phaserforge', catalog);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('build: missing workflow command "npm run build --stale"');
  });
});
