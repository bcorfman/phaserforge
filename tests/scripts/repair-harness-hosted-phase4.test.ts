import { describe, expect, it } from 'vitest';
import { parseHostedConfig } from '../../scripts/repair-harness/hosted/config';
import { assertSeparateHostedAccounts } from '../../scripts/repair-harness/hosted/accounts';
import { assertHostedIsolationInputs, makeHostedIsolationMarker, projectHostedIsolationResult } from '../../scripts/repair-harness/hosted/isolation';

const config = parseHostedConfig({
  HOSTED_DEV_FRONTEND_URL: 'https://pages.example/dev/', HOSTED_DEV_API_URL: 'https://dev-api.example',
  HOSTED_STABLE_FRONTEND_URL: 'https://pages.example/stable/', HOSTED_STABLE_API_URL: 'https://stable-api.example',
  HOSTED_TEST_ACCOUNT_PROVIDER: 'manual', HOSTED_ALLOWED_API_HOSTS: 'dev-api.example,stable-api.example',
});
const accounts = { dev: { email: 'dev@example.test', password: 'dev-secret' }, stable: { email: 'stable@example.test', password: 'stable-secret' } };

describe('hosted dev/stable isolation phase 4', () => {
  it('requires two distinct non-empty accounts', () => {
    expect(() => assertSeparateHostedAccounts({ ...accounts, stable: accounts.dev })).toThrow('must be distinct');
    expect(() => assertSeparateHostedAccounts({ ...accounts, dev: { email: '', password: 'secret' } })).toThrow('development');
  });
  it('requires distinct configured API origins', () => {
    expect(() => assertHostedIsolationInputs({ ...config, stableApiUrl: config.devApiUrl }, accounts)).toThrow('origins must be distinct');
    expect(() => assertHostedIsolationInputs(config, accounts)).not.toThrow();
  });
  it('creates channel-specific run markers and projects only safe isolation fields', () => {
    expect(makeHostedIsolationMarker('run/42', 'DEV')).toBe('REPAIR-HARNESS-DEV-run-42');
    expect(makeHostedIsolationMarker('run/42', 'STABLE')).toBe('REPAIR-HARNESS-STABLE-run-42');
    const projected = projectHostedIsolationResult({ status: 'passed', cleanupConfirmed: true, dev: { marker: 'dev', projectId: 'd1', presentInOppositeEnvironment: false, presentAfterDeletion: false }, stable: { marker: 'stable', projectId: 's1', presentInOppositeEnvironment: false, presentAfterDeletion: false }, reasons: [] });
    expect(projected).toEqual({ status: 'passed', cleanupConfirmed: true, dev: { marker: 'dev', projectId: 'd1', presentInOppositeEnvironment: false, presentAfterDeletion: false }, stable: { marker: 'stable', projectId: 's1', presentInOppositeEnvironment: false, presentAfterDeletion: false } });
    expect(JSON.stringify(projected)).not.toContain('secret');
  });
});
