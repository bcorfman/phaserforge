import { chromium, type Browser, type Page } from '@playwright/test';
import type { HostedConfig } from './config';
import { assertSeparateHostedAccounts, type HostedIsolationAccounts } from './accounts';
import type { HostedAccount } from './browser';
import { assertHostedBounds, hostedOperationBudget } from './bounds';

export interface HostedIsolationObservation {
  marker: string;
  projectId?: string;
  presentInOppositeEnvironment: boolean;
  presentAfterDeletion: boolean;
}

export interface HostedIsolationResult {
  status: 'passed' | 'failed' | 'cleanup-required';
  dev: HostedIsolationObservation;
  stable: HostedIsolationObservation;
  cleanupConfirmed: boolean;
  reasons: string[];
}

export function makeHostedIsolationMarker(runId: string, channel: 'DEV' | 'STABLE'): string {
  const marker = runId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'run';
  return `REPAIR-HARNESS-${channel}-${marker}`;
}

export function assertHostedIsolationInputs(config: HostedConfig, accounts: HostedIsolationAccounts): void {
  assertSeparateHostedAccounts(accounts);
  if (new URL(config.devApiUrl).origin === new URL(config.stableApiUrl).origin) {
    throw new Error('Development and stable API origins must be distinct for isolation checks.');
  }
}

export function projectHostedIsolationResult(result: HostedIsolationResult): object {
  return {
    status: result.status,
    cleanupConfirmed: result.cleanupConfirmed,
    dev: {
      marker: result.dev.marker,
      ...(result.dev.projectId ? { projectId: result.dev.projectId } : {}),
      presentInOppositeEnvironment: result.dev.presentInOppositeEnvironment,
      presentAfterDeletion: result.dev.presentAfterDeletion,
    },
    stable: {
      marker: result.stable.marker,
      ...(result.stable.projectId ? { projectId: result.stable.projectId } : {}),
      presentInOppositeEnvironment: result.stable.presentInOppositeEnvironment,
      presentAfterDeletion: result.stable.presentAfterDeletion,
    },
  };
}

export async function runHostedIsolation(options: {
  config: HostedConfig;
  runId: string;
  accounts: HostedIsolationAccounts;
  browser?: Browser;
}): Promise<HostedIsolationResult> {
  assertHostedIsolationInputs(options.config, options.accounts);
  assertHostedBounds(hostedOperationBudget(options.config), { browserCount: 1, mutationCount: 2, cleanupAttempts: 2, elapsedMs: 0 });
  const browser = options.browser ?? await chromium.launch({ headless: true });
  const ownsBrowser = !options.browser;
  const dev = { marker: makeHostedIsolationMarker(options.runId, 'DEV'), presentInOppositeEnvironment: false, presentAfterDeletion: false };
  const stable = { marker: makeHostedIsolationMarker(options.runId, 'STABLE'), presentInOppositeEnvironment: false, presentAfterDeletion: false };
  const reasons: string[] = [];
  let devId: string | undefined;
  let stableId: string | undefined;
  const devContext = await browser.newContext({ serviceWorkers: 'block' });
  const stableContext = await browser.newContext({ serviceWorkers: 'block' });
  const devPage = await devContext.newPage();
  const stablePage = await stableContext.newPage();
  try {
    await signIn(devPage, options.config.devFrontendUrl, options.accounts.dev, options.config.timeoutMs);
    await signIn(stablePage, options.config.stableFrontendUrl, options.accounts.stable, options.config.timeoutMs);
    devId = await create(devPage, options.config.devApiUrl, dev.marker);
    dev.projectId = devId;
    stable.presentInOppositeEnvironment = await hasMarker(stablePage, options.config.stableApiUrl, dev.marker);
    if (stable.presentInOppositeEnvironment) reasons.push('Development marker was visible in stable.');
    stableId = await create(stablePage, options.config.stableApiUrl, stable.marker);
    stable.projectId = stableId;
    dev.presentInOppositeEnvironment = await hasMarker(devPage, options.config.devApiUrl, stable.marker);
    if (dev.presentInOppositeEnvironment) reasons.push('Stable marker was visible in development.');
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  } finally {
    dev.presentAfterDeletion = await deleteAndCheck(devPage, options.config.devApiUrl, devId, dev.marker, reasons);
    stable.presentAfterDeletion = await deleteAndCheck(stablePage, options.config.stableApiUrl, stableId, stable.marker, reasons);
    await devContext.close();
    await stableContext.close();
    if (ownsBrowser) await browser.close();
  }
  const cleanupConfirmed = Boolean((!devId || !dev.presentAfterDeletion) && (!stableId || !stable.presentAfterDeletion));
  if (!cleanupConfirmed) reasons.push('Isolation cleanup could not be confirmed.');
  return { status: !cleanupConfirmed ? 'cleanup-required' : reasons.length ? 'failed' : 'passed', dev, stable, cleanupConfirmed, reasons };
}

async function signIn(page: Page, frontendUrl: string, account: HostedAccount, timeoutMs: number): Promise<void> {
  await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByTestId('cloud-account-submit').click();
  await page.getByText('Signed in', { exact: true }).waitFor({ state: 'visible', timeout: timeoutMs });
}

async function request<T>(page: Page, apiUrl: string, path: string, method: string, body?: unknown): Promise<T> {
  return page.evaluate(async ({ apiUrl: base, path: requestPath, method: requestMethod, body: requestBody }) => {
    const csrf = requestMethod === 'GET' ? undefined : await (await fetch(new URL('/api/v1/auth/csrf', `${base}/`).toString(), { credentials: 'include' })).json() as { csrfToken?: string };
    const response = await fetch(new URL(requestPath, `${base}/`).toString(), { method: requestMethod, credentials: 'include', headers: { ...(requestBody === undefined ? {} : { 'content-type': 'application/json' }), ...(csrf?.csrfToken ? { 'x-csrf-token': csrf.csrfToken } : {}) }, ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Hosted API ${requestMethod} ${requestPath} returned ${response.status}.`);
    return json as T;
  }, { apiUrl, path, method, body });
}

async function create(page: Page, apiUrl: string, marker: string): Promise<string> {
  const result = await request<{ game?: { id?: string } }>(page, apiUrl, '/api/v1/games', 'POST', { title: marker, project: { id: marker, scenes: {}, assets: {}, audio: {}, inputMaps: {}, collections: {}, counters: {}, initialSceneId: null, pixelsPerUnit: 2, renderMode: 'smooth-2d' } });
  if (!result.game?.id) throw new Error(`Hosted API did not return an id for ${marker}.`);
  return result.game.id;
}

async function hasMarker(page: Page, apiUrl: string, marker: string): Promise<boolean> {
  const result = await request<{ games?: Array<{ title?: string }> }>(page, apiUrl, '/api/v1/games', 'GET');
  return result.games?.some((game) => game.title === marker) ?? false;
}

async function deleteAndCheck(page: Page, apiUrl: string, id: string | undefined, marker: string, reasons: string[]): Promise<boolean> {
  if (!id) return false;
  try {
    await request(page, apiUrl, `/api/v1/games/${encodeURIComponent(id)}`, 'DELETE');
    return await hasMarker(page, apiUrl, marker);
  } catch (error) {
    reasons.push(`Cleanup failed for ${marker}: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}
