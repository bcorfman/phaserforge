export type SeedInput = string | number;

function hashSeed(input: SeedInput): number {
  const text = String(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seed: SeedInput, stream: string): number {
  const mixed = `${seed}:${stream}`;
  const hash = hashSeed(mixed);
  return hash === 0 ? 0x9e3779b9 : hash;
}

export function createSeededRandom(seed: SeedInput, stream = 'default'): () => number {
  let state = normalizeSeed(seed, stream);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeRange(min: number, max: number): { min: number; max: number } {
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : a;
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

export function randomFloatInRange(random: () => number, min: number, max: number): number {
  const range = normalizeRange(min, max);
  return range.min + random() * (range.max - range.min);
}

export function randomIntInRange(random: () => number, min: number, max: number): number {
  const range = normalizeRange(Math.floor(min), Math.floor(max));
  return Math.floor(random() * (range.max - range.min + 1)) + range.min;
}

export function makeSeed(prefix = 'seed', now: number = Date.now()): string {
  return `${prefix}-${now.toString(36)}`;
}
