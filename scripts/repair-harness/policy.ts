export interface PolicyOptions { maxChangedFiles?: number; allowedPaths?: RegExp; allowTimingConfig?: boolean; }

export interface PolicyResult { allowed: boolean; violations: string[]; changedFiles: string[]; }
export interface StagnationInput { previousFingerprints: string[]; currentFingerprint: string; changedFiles: string[]; allowedProductFiles?: RegExp; }
export interface RepairRequest { failureClass: string; requestedFiles: string[]; currentDiff?: string; maxChangedFiles?: number; }

const DEFAULT_MAX_FILES = 12;

export function evaluatePolicy(diff: string, options: PolicyOptions = {}): PolicyResult {
  const violations: string[] = [];
  const changedFiles = [...diff.matchAll(/^(?:[MADRCU?!])[0-9]*\s+(.+)$/gm)].map((match) => match[1].trim().replace(/^"|"$/g, ''));
  for (const match of diff.matchAll(/^\+\+\+ b\/(.+)$/gm)) if (!changedFiles.includes(match[1])) changedFiles.push(match[1]);
  const maxFiles = options.maxChangedFiles ?? DEFAULT_MAX_FILES;
  if (changedFiles.length > maxFiles) violations.push(`Changed file scope exceeds ${maxFiles} files.`);
  for (const file of changedFiles) {
    if (options.allowedPaths && !options.allowedPaths.test(file)) violations.push(`Path is outside the allowed scope: ${file}`);
    if (/^\.github\/workflows\//.test(file)) violations.push(`Workflow modification is denied: ${file}`);
    const timingConfig = options.allowTimingConfig && file === 'playwright.config.ts';
    if (!timingConfig && (/(^|\/)(?:\.env(?:\.|$)|secrets?\b|credentials?\b|config(?:uration)?\b)/i.test(file) || /(?:^|\/)config\//i.test(file))) violations.push(`Secret/config path modification is denied: ${file}`);
    if (/(?:^|\/)(?:playwright|vitest|vite|tsconfig)\.config\.[^/]+$/.test(file)) violations.push(`Test/build configuration modification is denied: ${file}`);
  }
  const additions = diff.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  if (changedFiles.some((file) => /(?:^|\/)(?:tests?|__tests__)\//i.test(file) && diff.includes(`D\t${file}`)) || /\b(?:test|it|describe)\.skip\b|\btest\.only\b|\bdescribe\.only\b/i.test(additions)) violations.push('Test removal/skip/selection changes are denied.');
  if (/\b(?:timeout|testTimeout|actionTimeout|navigationTimeout|expect\.configure)\b|\bretries\s*[:=]|--retries\b/i.test(additions)) violations.push('Timeout/retry inflation is denied.');
  if (/\bworkers\s*[:=]/i.test(additions)) violations.push('Worker-count changes are denied.');
  return { allowed: violations.length === 0, violations, changedFiles };
}

export function stagnationReasons(input: StagnationInput): string[] {
  const reasons: string[] = [];
  if (input.previousFingerprints.includes(input.currentFingerprint)) reasons.push('Evidence fingerprint repeated.');
  const productFiles = input.allowedProductFiles
    ? input.changedFiles.filter((file) => input.allowedProductFiles!.test(file))
    : input.changedFiles.filter((file) => !/^\.github\/|(?:config|secrets?)\//i.test(file));
  if (productFiles.length === 0) reasons.push('No allowed product file changed.');
  return reasons;
}

export function approveRepairRequest(request: RepairRequest & { allowTimingConfig?: boolean }): PolicyResult {
  const result = evaluatePolicy(request.currentDiff ?? '', { maxChangedFiles: request.maxChangedFiles, allowTimingConfig: request.allowTimingConfig });
  if (request.failureClass === 'infrastructure') result.violations.push('Infrastructure failures cannot be sent for implementation.');
  if (!request.requestedFiles.length) result.violations.push('Diagnosis requested no implementation files.');
  for (const file of request.requestedFiles) {
    const timingConfig = request.allowTimingConfig && file === 'playwright.config.ts';
    if (/^\.github\/|(?:^|\/)(?:\.env|secrets?|credentials?)(?:\.|\/|$)/i.test(file) || (!timingConfig && /(?:^|\/)(?:playwright|vitest|vite|tsconfig)\.config\./i.test(file))) result.violations.push(`Requested path is denied: ${file}`);
  }
  if (request.requestedFiles.length > (request.maxChangedFiles ?? DEFAULT_MAX_FILES)) result.violations.push(`Requested file scope exceeds ${request.maxChangedFiles ?? DEFAULT_MAX_FILES} files.`);
  return { ...result, allowed: result.violations.length === 0 };
}
