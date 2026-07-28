import { redactSecrets } from '../artifacts';

const APPROVED_HEADERS = new Set(['cache-control', 'content-type', 'strict-transport-security', 'access-control-allow-origin', 'access-control-allow-credentials']);

export interface HostedResponseProjection {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: Record<string, string>;
}

export function projectHostedResponse(status: number, headers: Headers, body: unknown, fields: string[]): HostedResponseProjection {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const projected = Object.fromEntries(fields.filter((field) => typeof source[field] === 'string').map((field) => [field, String(source[field])]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: Object.fromEntries([...headers.entries()].filter(([name]) => APPROVED_HEADERS.has(name.toLowerCase())).map(([name, value]) => [name.toLowerCase(), redactSecrets(value)])),
    body: projected,
  };
}

export function redactHostedReason(reason: string): string { return redactSecrets(reason).slice(0, 500); }
