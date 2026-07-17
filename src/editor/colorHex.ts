export function parseRgbHex(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
  return Number.parseInt(normalized, 16);
}

export function formatRgbHex(value: number | undefined): string {
  if (value == null) return '';
  const hex = Math.max(0, Math.min(0xffffff, Math.floor(value))).toString(16).padStart(6, '0');
  return `#${hex}`;
}
