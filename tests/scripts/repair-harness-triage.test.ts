import { describe, expect, it } from 'vitest';

import { classifyFailure, extractFailure } from '../../scripts/repair-harness/triage';
import { extractArtifactMetadata, redactSecrets } from '../../scripts/repair-harness/artifacts';

describe('repair harness triage', () => {
  it('classifies Playwright assertions and locates the test', () => {
    const result = classifyFailure([
      'Running 1 test using 1 worker',
      '  1) tests/e2e/editor.spec.ts:42:5 › saves a project',
      'Error: expect(locator).toBeVisible()',
      'at tests/e2e/editor.spec.ts:42:5',
    ].join('\n'));

    expect(result).toMatchObject({
      class: 'assertion',
      testFile: 'tests/e2e/editor.spec.ts',
      testTitle: 'saves a project',
    });
  });

  it('classifies runner and network failures as infrastructure', () => {
    expect(classifyFailure('Error: browserType.launch: Executable doesn\'t exist')).toMatchObject({ class: 'infrastructure' });
    expect(classifyFailure('fetch failed: getaddrinfo ENOTFOUND api.example.test')).toMatchObject({ class: 'infrastructure' });
  });

  it('extracts a bounded failure from a log', () => {
    const result = extractFailure([
      'setup',
      'Error: expect(received).toBe(expected)',
      'Expected: 2',
      'Received: 1',
      'at tests/example.spec.ts:8:3',
      'cleanup',
    ].join('\n'));

    expect(result.message).toContain('expect(received)');
    expect(result.stackExcerpt).not.toContain('setup');
    expect(result.stackExcerpt).toContain('tests/example.spec.ts');
  });
});

describe('repair harness artifacts', () => {
  it('redacts credentials, cookies, and authorization headers', () => {
    const redacted = redactSecrets('token=abc123 Authorization: Bearer secret cookie=foo=bar password: hunter2');
    expect(redacted).toBe('token=[REDACTED] Authorization: Bearer [REDACTED] cookie=[REDACTED] password: [REDACTED]');
  });

  it('extracts only Playwright artifact metadata', () => {
    expect(extractArtifactMetadata(['playwright-report/index.html', 'test-results/a/trace.zip', 'test-results/a/video.webm', 'notes.txt']))
      .toEqual({
        tracePaths: ['test-results/a/trace.zip'],
        screenshotPaths: [],
        reportPath: 'playwright-report/index.html',
      });
  });
});
