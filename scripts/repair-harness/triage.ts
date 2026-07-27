import type { FailureClass, FailureEvidence } from './types';

const INFRASTRUCTURE_PATTERNS = [
  /browser(?:type)?\.launch/i,
  /executable doesn['’]t exist/i,
  /no usable sandbox/i,
  /failed to connect/i,
  /econnreset|enotfound|etimedout|network error|fetch failed/i,
  /github actions runner|runner has failed|action failed/i,
  /rate limit/i,
];

function findTestLocation(log: string): { testFile?: string; testTitle?: string } {
  const titleMatch = log.match(/(?:\d+\)\s+)?((?:tests?\/|e2e\/)[^:\n]+:\d+:\d+)\s+›\s+([^\n]+)/i);
  const fileMatch = log.match(/((?:tests?\/|e2e\/)[^:\s)]+\.(?:spec|test)\.[jt]sx?)(?::\d+(?::\d+)?)?/i);
  return {
    testFile: fileMatch?.[1] ?? titleMatch?.[1]?.replace(/:\d+:\d+$/, ''),
    testTitle: titleMatch?.[2]?.trim(),
  };
}

function firstMeaningfulLine(log: string): string {
  return log.split(/\r?\n/).map((line) => line.trim()).find((line) =>
    /^(?:error|error:|assertionerror|fail|failed|typeerror|syntaxerror|ts\d+|✘)/i.test(line),
  ) ?? log.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? 'Unknown CI failure';
}

export function classifyFailure(log: string): FailureEvidence {
  const location = findTestLocation(log);
  let failureClass: FailureClass = 'unknown';
  if (INFRASTRUCTURE_PATTERNS.some((pattern) => pattern.test(log))) failureClass = 'infrastructure';
  else if (/timeout|timed out|exceeded the limit/i.test(log)) failureClass = 'timeout';
  else if (/browser has disconnected|page crashed|browser crash|target page, context or browser has been closed/i.test(log)) failureClass = 'browser-crash';
  else if (/typescript|ts\d{3,4}|build failed|vite.*error|cannot find module|syntaxerror/i.test(log)) failureClass = 'compile';
  else if (/assert(?:ion)?error|expect\(|toBe|toEqual|received:|expected:/i.test(log)) failureClass = 'assertion';

  const lines = log.split(/\r?\n/);
  const meaningfulIndex = lines.findIndex((line) => /error|assert|fail|expected|received/i.test(line));
  const start = Math.max(0, meaningfulIndex < 0 ? 0 : meaningfulIndex);
  const stackExcerpt = lines.slice(start, start + 30).join('\n').trim();
  return { class: failureClass, message: firstMeaningfulLine(log), stackExcerpt, ...location };
}

export function extractFailure(log: string): FailureEvidence {
  return classifyFailure(log);
}
