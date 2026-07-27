export function parseAvailableFields(text: string): string[] {
  const match = text.match(/Available fields:\s*([\s\S]+)/i);
  if (!match) return [];
  return match[1].split('\n').map((line) => line.trim()).filter((line) => /^[a-zA-Z][\w-]*$/.test(line));
}

export function isFailingCheck(check: Record<string, unknown>): boolean {
  const failures = new Set(['failure', 'error', 'cancelled', 'timed_out', 'action_required', 'fail']);
  return failures.has(String(check.conclusion ?? '').toLowerCase())
    || failures.has(String(check.state ?? check.status ?? '').toLowerCase())
    || failures.has(String(check.bucket ?? '').toLowerCase());
}

export function extractRunIdFromUrl(url: string): string | null {
  return url.match(/\/actions\/runs\/(\d+)/)?.[1] ?? null;
}

export function extractFailureSnippet(logText: string, maxLines = 120, context = 20): string {
  const lines = logText.split(/\r?\n/);
  const failureIndex = lines.findIndex((line) => /error|fail|failed|traceback|exception|assert|panic|fatal|timeout/i.test(line));
  if (failureIndex < 0) return lines.slice(-maxLines).join('\n').trim();
  const start = Math.max(0, failureIndex - context);
  return lines.slice(start, Math.min(lines.length, start + maxLines)).join('\n').trim();
}
