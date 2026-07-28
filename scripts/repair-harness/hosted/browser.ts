import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { HostedConfig } from './config';

export interface HostedBrowserResponse {
  origin: string;
  path: string;
  status: number;
  contentType?: string;
  durationMs?: number;
}

export interface HostedBrowserSmokeResult {
  status: 'passed' | 'failed';
  finalUrl: string;
  apiOrigin: string;
  apiReachable: boolean;
  unauthenticated: boolean;
  unexpectedApiOrigins: string[];
  requestFailures: Array<{ url: string; method: string; error: string }>;
  consoleErrors: string[];
  responses: HostedBrowserResponse[];
  reasons: string[];
}

export interface HostedMutationResult {
  status: 'passed' | 'failed' | 'cleanup-required';
  projectName: string;
  createdProjectId?: string;
  updatedProjectFoundAfterReload: boolean;
  cleanupConfirmed: boolean;
  reasons: string[];
}

export interface HostedAccount {
  email: string;
  password: string;
  inviteToken?: string;
}

export function makeHostedProjectName(runId: string): string {
  const marker = runId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'run';
  return `REPAIR-HARNESS-DEV-${marker}`;
}

export function redactBrowserUrl(value: string): string {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}

export function projectBrowserResponse(url: string, status: number, contentType: string | undefined, durationMs?: number): HostedBrowserResponse {
  const parsed = new URL(url);
  return {
    origin: parsed.origin,
    path: parsed.pathname,
    status,
    ...(contentType ? { contentType: contentType.split(';', 1)[0] } : {}),
    ...(durationMs === undefined ? {} : { durationMs }),
  };
}

export function assertHostedMutationAllowed(config: HostedConfig, explicitFlag: boolean): void {
  if (!explicitFlag) throw new Error('Hosted mutation requires the explicit --allow-hosted-mutations flag.');
  if (!config.allowMutations) throw new Error('Hosted mutation requires HOSTED_ALLOW_MUTATIONS=true in the validated config.');
}

export async function runHostedBrowserSmoke(options: {
  config: HostedConfig;
  browser?: Browser;
  launch?: () => Promise<Browser>;
  timeoutMs?: number;
}): Promise<HostedBrowserSmokeResult> {
  const browser = options.browser ?? (await (options.launch ?? (() => chromium.launch({ headless: true })))());
  const ownsBrowser = !options.browser;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const result = await collectHostedBrowserSmoke(page, options.config, options.timeoutMs);
  await context.close();
  if (ownsBrowser) await browser.close();
  return result;
}

export async function collectHostedBrowserSmoke(page: Page, config: HostedConfig, timeoutMs = config.timeoutMs): Promise<HostedBrowserSmokeResult> {
  const requestFailures: HostedBrowserSmokeResult['requestFailures'] = [];
  const consoleErrors: string[] = [];
  const responses: HostedBrowserResponse[] = [];
  const unexpectedApiOrigins = new Set<string>();
  const requestStarted = new Map<string, number>();
  const apiOrigin = new URL(config.devApiUrl).origin;

  page.on('request', (request) => requestStarted.set(`${request.method()} ${redactBrowserUrl(request.url())}`, Date.now()));
  page.on('request', (request) => {
    try {
      const parsed = new URL(request.url());
      if (parsed.pathname.startsWith('/api/v1/') && parsed.origin !== apiOrigin) unexpectedApiOrigins.add(parsed.origin);
    } catch {
      // Invalid request URLs are covered by Playwright's request-failure event.
    }
  });
  page.on('requestfailed', (request) => requestFailures.push({
    url: redactBrowserUrl(request.url()),
    method: request.method(),
    error: request.failure()?.errorText ?? 'request_failed',
  }));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('response', (response) => {
    try {
      const parsed = new URL(response.url());
      if (parsed.origin !== apiOrigin) return;
      const key = `${response.request().method()} ${redactBrowserUrl(response.url())}`;
      const started = requestStarted.get(key);
      responses.push(projectBrowserResponse(response.url(), response.status(), response.headers()['content-type'], started === undefined ? undefined : Date.now() - started));
    } catch {
      // A malformed response URL is represented by the request failure, not persisted.
    }
  });

  const reasons: string[] = [];
  let apiReachable = false;
  let unauthenticated = false;
  await page.goto(config.devFrontendUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.locator('body').waitFor({ state: 'visible', timeout: timeoutMs });

  const apiResults = await page.evaluate(async (apiUrl) => {
    const fetchStatus = async (path: string) => {
      const response = await fetch(new URL(path, `${apiUrl}/`).toString(), { credentials: 'include', cache: 'no-store' });
      return response.status;
    };
    return { health: await fetchStatus('/api/v1/health'), me: await fetchStatus('/api/v1/auth/me') };
  }, config.devApiUrl);
  apiReachable = apiResults.health === 200;
  unauthenticated = apiResults.me === 401;
  if (!apiReachable) reasons.push(`Development API health returned ${apiResults.health}.`);
  if (!unauthenticated) reasons.push(`Expected unauthenticated /auth/me status 401, received ${apiResults.me}.`);
  if (unexpectedApiOrigins.size) reasons.push(`API requests targeted unexpected origin(s): ${[...unexpectedApiOrigins].join(', ')}.`);
  if (!new URL(page.url()).origin || page.url() === 'about:blank') reasons.push('The configured frontend did not produce a final browser URL.');
  if (requestFailures.length) reasons.push(`${requestFailures.length} browser request(s) failed.`);
  if (consoleErrors.length) reasons.push(`${consoleErrors.length} browser console error(s) were reported.`);

  return {
    status: reasons.length ? 'failed' : 'passed',
    finalUrl: redactBrowserUrl(page.url()),
    apiOrigin,
    apiReachable,
    unauthenticated,
    unexpectedApiOrigins: [...unexpectedApiOrigins],
    requestFailures,
    consoleErrors,
    responses,
    reasons,
  };
}

export async function runHostedMutation(options: {
  page: Page;
  config: HostedConfig;
  runId: string;
  account: HostedAccount;
  signup?: boolean;
  explicitFlag: boolean;
  project?: Record<string, unknown>;
}): Promise<HostedMutationResult> {
  assertHostedMutationAllowed(options.config, options.explicitFlag);
  const projectName = makeHostedProjectName(options.runId);
  const reasons: string[] = [];
  let createdProjectId: string | undefined;
  let cleanupConfirmed = false;
  let updatedProjectFoundAfterReload = false;
  const project = options.project ?? { id: `repair-${options.runId}`, scenes: {}, assets: {}, audio: {}, inputMaps: {}, collections: {}, counters: {}, initialSceneId: null, pixelsPerUnit: 2, renderMode: 'smooth-2d' };

  await options.page.goto(options.config.devFrontendUrl, { waitUntil: 'domcontentloaded', timeout: options.config.timeoutMs });
  if (options.signup) {
    await options.page.getByRole('tab', { name: 'Create' }).click();
  }
  await options.page.getByLabel('Email').fill(options.account.email);
  await options.page.getByLabel('Password').fill(options.account.password);
  if (options.signup && options.account.inviteToken) await options.page.getByLabel('Invite code').fill(options.account.inviteToken);
  await options.page.getByTestId('cloud-account-submit').click();
  await options.page.getByText('Signed in', { exact: true }).waitFor({ state: 'visible', timeout: options.config.timeoutMs });

  try {
    const created = await cloudRequest<{ game?: { id?: string } }>(options.page, options.config.devApiUrl, '/api/v1/games', 'POST', { title: projectName, project });
    createdProjectId = created.game?.id;
    if (!createdProjectId) throw new Error('Create response did not contain a project id.');
    await cloudRequest(options.page, options.config.devApiUrl, `/api/v1/games/${encodeURIComponent(createdProjectId)}`, 'PUT', { title: `${projectName}-UPDATED` });
    await options.page.reload({ waitUntil: 'domcontentloaded', timeout: options.config.timeoutMs });
    await options.page.getByText('Signed in', { exact: true }).waitFor({ state: 'visible', timeout: options.config.timeoutMs });
    const listed = await cloudRequest<{ games?: Array<{ title?: string }> }>(options.page, options.config.devApiUrl, '/api/v1/games', 'GET');
    updatedProjectFoundAfterReload = listed.games?.some((game) => game.title === `${projectName}-UPDATED`) ?? false;
    if (!updatedProjectFoundAfterReload) reasons.push('Updated project was not present after reload.');
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (createdProjectId) {
      try {
        await cloudRequest(options.page, options.config.devApiUrl, `/api/v1/games/${encodeURIComponent(createdProjectId)}`, 'DELETE');
        const listed = await cloudRequest<{ games?: Array<{ id?: string }> }>(options.page, options.config.devApiUrl, '/api/v1/games', 'GET');
        cleanupConfirmed = !listed.games?.some((game) => game.id === createdProjectId);
      } catch (error) {
        reasons.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (createdProjectId && !cleanupConfirmed) reasons.push('Created project cleanup could not be confirmed.');
  return { status: !cleanupConfirmed && createdProjectId ? 'cleanup-required' : reasons.length ? 'failed' : 'passed', projectName, createdProjectId, updatedProjectFoundAfterReload, cleanupConfirmed, reasons };
}

async function cloudRequest<T>(page: Page, apiUrl: string, path: string, method: string, body?: unknown): Promise<T> {
  return page.evaluate(async ({ apiUrl: base, path: requestPath, method: requestMethod, body: requestBody }) => {
    const csrf = requestMethod === 'GET' ? undefined : await (await fetch(new URL('/api/v1/auth/csrf', `${base}/`).toString(), { credentials: 'include' })).json() as { csrfToken?: string };
    const response = await fetch(new URL(requestPath, `${base}/`).toString(), {
      method: requestMethod,
      credentials: 'include',
      headers: {
        ...(requestBody === undefined ? {} : { 'content-type': 'application/json' }),
        ...(csrf?.csrfToken ? { 'x-csrf-token': csrf.csrfToken } : {}),
      },
      ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Hosted API ${requestMethod} ${requestPath} returned ${response.status}.`);
    return json as T;
  }, { apiUrl, path, method, body });
}
