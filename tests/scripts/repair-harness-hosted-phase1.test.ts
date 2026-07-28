import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHostedConfig } from '../../scripts/repair-harness/hosted/config';
import { projectHostedResponse } from '../../scripts/repair-harness/hosted/evidence';
import { classifyNetworkError, probeDeployment } from '../../scripts/repair-harness/hosted/probes';
import { runHostedProbe } from '../../scripts/repair-harness/hosted/run';

const input = { HOSTED_DEV_FRONTEND_URL: 'https://pages.example/dev/', HOSTED_DEV_API_URL: 'https://dev-api.example', HOSTED_STABLE_FRONTEND_URL: 'https://pages.example/stable/', HOSTED_STABLE_API_URL: 'https://stable-api.example', HOSTED_TEST_ACCOUNT_PROVIDER: 'manual', HOSTED_ALLOWED_API_HOSTS: 'dev-api.example,stable-api.example' };

describe('hosted deployment validation phase 1', () => {
  it('requires HTTPS, distinct allowlisted APIs, and safe defaults', () => {
    expect(parseHostedConfig(input)).toMatchObject({ expectedDevChannel: 'dev', expectedStableChannel: 'stable', allowMutations: false, allowOAuth: false });
    expect(() => parseHostedConfig({ ...input, HOSTED_DEV_API_URL: 'http://dev-api.example' })).toThrow('HTTPS');
    expect(() => parseHostedConfig({ ...input, HOSTED_ALLOWED_API_HOSTS: 'dev-api.example' })).toThrow('allowlist');
  });

  it('projects only approved health/version fields and headers', () => {
    const result = projectHostedResponse(200, new Headers({ 'content-type': 'application/json', authorization: 'Bearer secret', 'x-private': 'password=hidden' }), { status: 'ok', channel: 'dev', commit: 'abc', password: 'hidden' }, ['status', 'channel', 'commit']);
    expect(result.body).toEqual({ status: 'ok', channel: 'dev', commit: 'abc' });
    expect(result.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  it('distinguishes healthy, wrong channel, 5xx, DNS, TLS, and timeout results', async () => {
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const healthy = await probeDeployment(parseHostedConfig(input), async (url) => response(url.endsWith('/health') ? { status: 'ok' } : { channel: 'dev', commit: 'abc' }));
    expect(healthy.every((item) => !item.failureClass)).toBe(true);
    const wrong = await probeDeployment(parseHostedConfig({ ...input, HOSTED_EXPECTED_DEV_CHANNEL: 'preview' }), async (url) => response(url.endsWith('/health') ? { status: 'ok' } : { channel: 'dev', commit: 'abc' }));
    expect(wrong[1].failureClass).toBe('wrong-channel');
    expect((await probeDeployment(parseHostedConfig(input), async () => response({ error: 'nope' }, 503)))[0].failureClass).toBe('http-5xx');
    expect(classifyNetworkError(Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' }))).toBe('dns');
    expect(classifyNetworkError(Object.assign(new Error('certificate expired'), { code: 'CERT_HAS_EXPIRED' }))).toBe('tls');
    expect(classifyNetworkError(new Error('aborted'))).toBe('timeout');
  });

  it('writes a bounded hosted artifact envelope without response secrets', async () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'phaserforge-hosted-'));
    const result = await runHostedProbe({ repo, config: parseHostedConfig(input), runId: 'test-run', fetchImpl: async (url) => new Response(JSON.stringify(url.endsWith('/health') ? { status: 'ok' } : { channel: 'dev', commit: 'abc' }), { headers: { 'content-type': 'application/json' } }) });
    expect(result.runDirectory).toContain('test-run');
    expect(readFileSync(path.join(result.runDirectory, 'hosted-config.json'), 'utf8')).not.toContain('abc');
    expect(readFileSync(path.join(result.runDirectory, 'hosted-evidence.json'), 'utf8')).toContain('hosted-deployment-probe');
  });
});
