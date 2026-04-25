export type CallArgPrimitive = number | string | boolean | null;

export type ParseCallArgsJsonResult =
  | { ok: true; value: Record<string, CallArgPrimitive> }
  | { ok: false; error: string };

function isPrimitive(value: unknown): value is CallArgPrimitive {
  return value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}

export function parseCallArgsJson(text: string): ParseCallArgsJsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Advanced args must be a JSON object' };
  }

  const out: Record<string, CallArgPrimitive> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isPrimitive(value)) {
      return { ok: false, error: `Advanced args key "${key}" must be a number, string, boolean, or null` };
    }
    out[key] = value;
  }

  return { ok: true, value: out };
}

