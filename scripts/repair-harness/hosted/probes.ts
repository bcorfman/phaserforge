import type { HostedConfig } from './config';
import { projectHostedResponse, redactHostedReason, type HostedResponseProjection } from './evidence';

export type HostedFailureClass = 'dns' | 'tls' | 'timeout' | 'http-5xx' | 'wrong-channel' | 'wrong-commit' | 'http';
export interface HostedProbeResult { endpoint: 'health' | 'version'; url: string; durationMs: number; response?: HostedResponseProjection; failureClass?: HostedFailureClass; reason?: string; }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function probeDeployment(config: HostedConfig, fetchImpl: FetchLike = fetch): Promise<HostedProbeResult[]> {
  const results = [
    await probeEndpoint('health', config.devApiUrl, fetchImpl, ['status'], config.timeoutMs),
    await probeVersion(config, fetchImpl),
  ];
  const health = results[0];
  if (!health.failureClass && health.response?.body.status !== 'ok') {
    results[0] = { ...health, failureClass: 'http', reason: 'Health response did not contain status=ok.' };
  }
  return results;
}

async function probeEndpoint(endpoint: 'health' | 'version', baseUrl: string, fetchImpl: FetchLike, fields: string[], timeoutMs = 15_000): Promise<HostedProbeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/${endpoint}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } }),
      new Promise<Response>((_, reject) => { timeoutTimer = setTimeout(() => reject(new Error('Hosted probe timed out.')), timeoutMs); }),
    ]);
    const body = await response.json().catch(() => ({}));
    const projection = projectHostedResponse(response.status, response.headers, body, fields);
    return { endpoint, url, durationMs: Date.now() - started, response: projection, ...(response.status >= 500 ? { failureClass: 'http-5xx' as const, reason: `HTTP ${response.status}` } : response.ok ? {} : { failureClass: 'http' as const, reason: `HTTP ${response.status}` }) };
  } catch (error) {
    return { endpoint, url, durationMs: Date.now() - started, failureClass: classifyNetworkError(error), reason: redactHostedReason(error instanceof Error ? error.message : String(error)) };
  } finally { clearTimeout(timer); if (timeoutTimer) clearTimeout(timeoutTimer); }
}

async function probeVersion(config: HostedConfig, fetchImpl: FetchLike): Promise<HostedProbeResult> {
  const result = await probeEndpoint('version', config.devApiUrl, fetchImpl, ['channel', 'commit'], config.timeoutMs);
  const body = result.response?.body;
  if (!result.failureClass && body?.channel !== config.expectedDevChannel) return { ...result, failureClass: 'wrong-channel', reason: `Expected channel ${config.expectedDevChannel}; received ${body?.channel ?? '[missing]'}.` };
  if (!result.failureClass && config.expectedDevCommit && body?.commit !== config.expectedDevCommit) return { ...result, failureClass: 'wrong-commit', reason: 'Configured development commit does not match deployed commit.' };
  return result;
}

export function classifyNetworkError(error: unknown): 'dns' | 'tls' | 'timeout' {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || message.includes('dns')) return 'dns';
  if (code.startsWith('ERR_TLS') || code.includes('CERT') || message.includes('certificate') || message.includes('tls')) return 'tls';
  return 'timeout';
}
