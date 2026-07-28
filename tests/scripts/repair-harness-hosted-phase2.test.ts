import { describe, expect, it } from 'vitest';

import { parseHostedConfig } from '../../scripts/repair-harness/hosted/config';
import {
  assertHostedMutationAllowed,
  makeHostedProjectName,
  projectBrowserResponse,
  redactBrowserUrl,
} from '../../scripts/repair-harness/hosted/browser';

const config = parseHostedConfig({
  HOSTED_DEV_FRONTEND_URL: 'https://pages.example/dev/',
  HOSTED_DEV_API_URL: 'https://dev-api.example',
  HOSTED_STABLE_FRONTEND_URL: 'https://pages.example/stable/',
  HOSTED_STABLE_API_URL: 'https://stable-api.example',
  HOSTED_TEST_ACCOUNT_PROVIDER: 'manual',
  HOSTED_ALLOWED_API_HOSTS: 'dev-api.example,stable-api.example',
});

describe('hosted real-origin browser smoke phase 2', () => {
  it('normalizes the run marker and never stores URL query secrets', () => {
    expect(makeHostedProjectName('run/42')).toBe('REPAIR-HARNESS-DEV-run-42');
    expect(redactBrowserUrl('https://dev-api.example/api/v1/auth?token=secret')).toBe('https://dev-api.example/api/v1/auth');
  });

  it('projects only approved response metadata', () => {
    expect(projectBrowserResponse('https://dev-api.example/api/v1/health', 200, 'application/json', 42)).toEqual({
      origin: 'https://dev-api.example',
      path: '/api/v1/health',
      status: 200,
      contentType: 'application/json',
      durationMs: 42,
    });
  });

  it('keeps the configured development API origin distinct from stable', () => {
    expect(new URL(config.devApiUrl).origin).toBe('https://dev-api.example');
    expect(new URL(config.stableApiUrl).origin).not.toBe(new URL(config.devApiUrl).origin);
  });

  it('requires both config opt-in and an explicit mutation flag', () => {
    expect(() => assertHostedMutationAllowed(config, false)).toThrow('allow-hosted-mutations');
    expect(() => assertHostedMutationAllowed(config, true)).toThrow('HOSTED_ALLOW_MUTATIONS');
    expect(() => assertHostedMutationAllowed({ ...config, allowMutations: true }, true)).not.toThrow();
  });
});
