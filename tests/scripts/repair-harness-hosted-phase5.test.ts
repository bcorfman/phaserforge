import { describe, expect, it } from 'vitest';
import { parseHostedConfig } from '../../scripts/repair-harness/hosted/config';
import { assertHostedBounds, type HostedOperationBudget } from '../../scripts/repair-harness/hosted/bounds';
import { assertManualOAuthCheckpoint, runHostedOAuthPreflight } from '../../scripts/repair-harness/hosted/oauth';
import { assertHostedScope, assertRepairCannotUseHostedScope } from '../../scripts/repair-harness/scope';

const input = {
  HOSTED_DEV_FRONTEND_URL: 'https://pages.example/dev/', HOSTED_DEV_API_URL: 'https://dev-api.example',
  HOSTED_STABLE_FRONTEND_URL: 'https://pages.example/stable/', HOSTED_STABLE_API_URL: 'https://stable-api.example',
  HOSTED_TEST_ACCOUNT_PROVIDER: 'manual', HOSTED_ALLOWED_API_HOSTS: 'dev-api.example,stable-api.example',
  HOSTED_ALLOW_OAUTH: true,
  HOSTED_OAUTH_CALLBACK_HOST: 'pages.example',
  HOSTED_EXPECTED_DEV_OAUTH_REDIRECT: 'https://pages.example/dev/oauth/callback',
  HOSTED_EXPECTED_STABLE_OAUTH_REDIRECT: 'https://pages.example/stable/oauth/callback',
};

describe('hosted OAuth preflight and bounds phase 5', () => {
  it('validates configured dev/stable redirect hosts without authorizing a provider', () => {
    const config = parseHostedConfig(input);
    expect(runHostedOAuthPreflight(config, true)).toEqual({ status: 'passed', callbackHost: 'pages.example', devRedirect: '/dev/oauth/callback', stableRedirect: '/stable/oauth/callback', reasons: [] });
    expect(() => runHostedOAuthPreflight(parseHostedConfig({ ...input, HOSTED_EXPECTED_STABLE_OAUTH_REDIRECT: 'https://other.example/callback' }), true)).toThrow('callback host');
  });

  it('requires explicit opt-in and a human checkpoint for live OAuth', () => {
    const config = parseHostedConfig(input);
    expect(() => runHostedOAuthPreflight(config, false)).toThrow('explicit');
    expect(() => assertManualOAuthCheckpoint(undefined)).toThrow('manual');
    expect(() => assertManualOAuthCheckpoint('operator-approved-2026-07-28')).not.toThrow();
  });

  it('enforces independent browser, mutation, cleanup, and timeout budgets', () => {
    const budget: HostedOperationBudget = { browserCount: 1, mutationCount: 2, cleanupAttempts: 2, timeoutMs: 15000 };
    expect(() => assertHostedBounds(budget, { browserCount: 1, mutationCount: 2, cleanupAttempts: 2, elapsedMs: 14999 })).not.toThrow();
    expect(() => assertHostedBounds(budget, { browserCount: 2, mutationCount: 2, cleanupAttempts: 2, elapsedMs: 1 })).toThrow('browser');
    expect(() => assertHostedBounds(budget, { browserCount: 1, mutationCount: 3, cleanupAttempts: 2, elapsedMs: 1 })).toThrow('mutation');
    expect(() => assertHostedBounds(budget, { browserCount: 1, mutationCount: 2, cleanupAttempts: 3, elapsedMs: 1 })).toThrow('cleanup');
    expect(() => assertHostedBounds(budget, { browserCount: 1, mutationCount: 2, cleanupAttempts: 2, elapsedMs: 15000 })).toThrow('timeout');
  });
});

describe('hosted scope and repair boundary phase 5', () => {
  it('requires hosted scope and rejects agent use for hosted operations', () => {
    expect(() => assertHostedScope('hosted-isolation', 'local')).toThrow('hosted');
    expect(() => assertHostedScope('hosted-isolation', 'hosted')).not.toThrow();
    expect(() => assertHostedScope('repair', 'hosted')).toThrow('hosted command');
    expect(() => assertRepairCannotUseHostedScope('hosted')).toThrow('repair path');
    expect(() => assertRepairCannotUseHostedScope('local')).not.toThrow();
  });
});
