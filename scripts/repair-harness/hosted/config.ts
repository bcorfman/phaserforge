import { readFileSync } from 'node:fs';

export type HostedAccountProvider = 'external' | 'manual' | 'fixture';

export interface HostedConfig {
  devFrontendUrl: string;
  devApiUrl: string;
  stableFrontendUrl: string;
  stableApiUrl: string;
  expectedDevChannel: string;
  expectedStableChannel: string;
  expectedDevCommit?: string;
  expectedStableCommit?: string;
  testAccountProvider: HostedAccountProvider;
  allowMutations: boolean;
  allowOAuth: boolean;
  timeoutMs: number;
  allowedApiHosts: string[];
}

export interface HostedConfigInput {
  HOSTED_DEV_FRONTEND_URL?: string;
  HOSTED_DEV_API_URL?: string;
  HOSTED_STABLE_FRONTEND_URL?: string;
  HOSTED_STABLE_API_URL?: string;
  HOSTED_EXPECTED_DEV_CHANNEL?: string;
  HOSTED_EXPECTED_STABLE_CHANNEL?: string;
  HOSTED_EXPECTED_DEV_COMMIT?: string;
  HOSTED_EXPECTED_STABLE_COMMIT?: string;
  HOSTED_TEST_ACCOUNT_PROVIDER?: string;
  HOSTED_ALLOW_MUTATIONS?: string | boolean;
  HOSTED_ALLOW_OAUTH?: string | boolean;
  HOSTED_TIMEOUT_MS?: string | number;
  HOSTED_ALLOWED_API_HOSTS?: string | string[];
}

export function parseHostedConfig(input: HostedConfigInput): HostedConfig {
  const config: HostedConfig = {
    devFrontendUrl: required(input.HOSTED_DEV_FRONTEND_URL, 'HOSTED_DEV_FRONTEND_URL'),
    devApiUrl: required(input.HOSTED_DEV_API_URL, 'HOSTED_DEV_API_URL'),
    stableFrontendUrl: required(input.HOSTED_STABLE_FRONTEND_URL, 'HOSTED_STABLE_FRONTEND_URL'),
    stableApiUrl: required(input.HOSTED_STABLE_API_URL, 'HOSTED_STABLE_API_URL'),
    expectedDevChannel: input.HOSTED_EXPECTED_DEV_CHANNEL?.trim() || 'dev',
    expectedStableChannel: input.HOSTED_EXPECTED_STABLE_CHANNEL?.trim() || 'stable',
    expectedDevCommit: optional(input.HOSTED_EXPECTED_DEV_COMMIT),
    expectedStableCommit: optional(input.HOSTED_EXPECTED_STABLE_COMMIT),
    testAccountProvider: parseProvider(input.HOSTED_TEST_ACCOUNT_PROVIDER),
    allowMutations: parseBoolean(input.HOSTED_ALLOW_MUTATIONS, false),
    allowOAuth: parseBoolean(input.HOSTED_ALLOW_OAUTH, false),
    timeoutMs: parseTimeout(input.HOSTED_TIMEOUT_MS),
    allowedApiHosts: parseHosts(input.HOSTED_ALLOWED_API_HOSTS),
  };
  validateHostedConfig(config);
  return config;
}

export function loadHostedConfig(filePath: string): HostedConfig {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as HostedConfigInput;
  return parseHostedConfig(raw);
}

export function validateHostedConfig(config: HostedConfig): void {
  const urls = [config.devFrontendUrl, config.devApiUrl, config.stableFrontendUrl, config.stableApiUrl];
  for (const value of urls) {
    const url = parseUrl(value);
    if (url.protocol !== 'https:') throw new Error(`Hosted URL must use HTTPS: ${value}`);
    if (url.username || url.password) throw new Error(`Hosted URL must not contain credentials: ${value}`);
  }
  const devApi = parseUrl(config.devApiUrl);
  const stableApi = parseUrl(config.stableApiUrl);
  if (devApi.origin === stableApi.origin) throw new Error('Development and stable API origins must be distinct.');
  if (!config.allowedApiHosts.includes(devApi.host) || !config.allowedApiHosts.includes(stableApi.host)) {
    throw new Error('Development and stable API hosts must be present in the configured API allowlist (HOSTED_ALLOWED_API_HOSTS).');
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 120_000) {
    throw new Error('HOSTED_TIMEOUT_MS must be an integer between 100 and 120000.');
  }
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function optional(value: string | undefined): string | undefined { return value?.trim() || undefined; }

function parseUrl(value: string): URL {
  try { return new URL(value); } catch { throw new Error(`Invalid hosted URL: ${value}`); }
}

function parseProvider(value: string | undefined): HostedAccountProvider {
  if (value !== 'external' && value !== 'manual' && value !== 'fixture') throw new Error('HOSTED_TEST_ACCOUNT_PROVIDER must be external, manual, or fixture.');
  return value;
}

function parseBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('Hosted boolean options must be true or false.');
}

function parseTimeout(value: string | number | undefined): number { return value === undefined ? 15_000 : Number(value); }

function parseHosts(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value?.split(',') ?? [];
  return values.map((host) => host.trim().toLowerCase()).filter(Boolean);
}
