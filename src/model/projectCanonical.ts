import type { ProjectSpec } from './types';

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function canonicalizeValue(value: unknown): CanonicalJson {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry));
  if (typeof value === 'object') {
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const next = (value as Record<string, unknown>)[key];
      if (next === undefined) continue;
      result[key] = canonicalizeValue(next);
    }
    return result;
  }
  return String(value);
}

export function canonicalizeProjectForComparison(project: ProjectSpec): string {
  return JSON.stringify(canonicalizeValue(project));
}

export function projectsSemanticallyEqual(left: ProjectSpec, right: ProjectSpec): boolean {
  return canonicalizeProjectForComparison(left) === canonicalizeProjectForComparison(right);
}
