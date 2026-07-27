import type { ArtifactMetadata } from './types';

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]'],
  [/(\b(?:token|password|passwd|secret|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]'],
  [/(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, '[REDACTED]'],
  [/(https?:\/\/[^\s/@]+):[^\s/@]+@/gi, '$1:[REDACTED]@'],
];

export function redactSecrets(value: string): string {
  return REDACTION_PATTERNS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
}

export function extractArtifactMetadata(paths: string[]): ArtifactMetadata {
  const normalized = paths.filter((item) => !item.includes('..')).map((item) => item.replaceAll('\\', '/'));
  return {
    tracePaths: normalized.filter((item) => /(?:^|\/)trace\.(?:zip|json)$/i.test(item)),
    screenshotPaths: normalized.filter((item) => /\.(?:png|jpe?g)$/i.test(item)),
    reportPath: normalized.find((item) => /(?:^|\/)playwright-report\/.*\.html$/i.test(item)),
  };
}
