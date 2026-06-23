import { describe, expect, it } from 'vitest';

import {
  extractFailureSnippet,
  extractRunIdFromUrl,
  isFailingCheck,
  parseAvailableFields,
} from '../../scripts/inspect-gh-actions-failures';

describe('inspect-gh-actions-failures helpers', () => {
  it('detects failing checks across conclusion, state, and bucket variants', () => {
    expect(isFailingCheck({ conclusion: 'failure' })).toBe(true);
    expect(isFailingCheck({ state: 'error' })).toBe(true);
    expect(isFailingCheck({ bucket: 'fail' })).toBe(true);
    expect(isFailingCheck({ conclusion: 'success', state: 'completed' })).toBe(false);
  });

  it('extracts available gh fields from cli errors', () => {
    const stderr = 'Unknown JSON field: "detailsUrl"\nAvailable fields:\n  bucket\n  completedAt\n  link\n  name\n  state\n  workflow\n';
    expect(parseAvailableFields(stderr)).toEqual(['bucket', 'completedAt', 'link', 'name', 'state', 'workflow']);
  });

  it('extracts a run id from GitHub Actions URLs', () => {
    expect(extractRunIdFromUrl('https://github.com/org/repo/actions/runs/123456789/job/987654321')).toBe('123456789');
    expect(extractRunIdFromUrl('https://github.com/org/repo/actions/runs/123456789')).toBe('123456789');
    expect(extractRunIdFromUrl('https://buildkite.com/org/repo/builds/12')).toBe(null);
  });

  it('extracts a tight failure snippet from logs', () => {
    const log = [
      'setup',
      'build starting',
      'running tests',
      'AssertionError: expected 380 to be greater than 600',
      'at tests/e2e/sidebar-assets-dock-layout.spec.ts:132:95',
      'teardown',
    ].join('\n');

    expect(extractFailureSnippet(log, 4, 1)).toContain('AssertionError');
    expect(extractFailureSnippet(log, 4, 1)).toContain('sidebar-assets-dock-layout.spec.ts');
  });
});
