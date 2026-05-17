import type { Id, ProjectSpec, TextEntitySpec } from '../model/types';

export type ResolvedTextEntitySpec = Required<Pick<TextEntitySpec, 'value' | 'fontSize' | 'color' | 'align'>> & Pick<TextEntitySpec, 'fontAssetId' | 'fontFamily'>;

export function resolveTextEntityDefaults(text: TextEntitySpec | undefined): ResolvedTextEntitySpec {
  return {
    value: typeof text?.value === 'string' ? text.value : 'Text',
    fontAssetId: typeof text?.fontAssetId === 'string' && text.fontAssetId.length > 0 ? text.fontAssetId : undefined,
    fontFamily: typeof text?.fontFamily === 'string' && text.fontFamily.trim().length > 0 ? text.fontFamily : undefined,
    fontSize: typeof text?.fontSize === 'number' && Number.isFinite(text.fontSize) && text.fontSize > 0 ? Math.round(text.fontSize) : 14,
    color: typeof text?.color === 'string' && text.color.trim().length > 0 ? text.color : '#FFFFFF',
    align: text?.align === 'left' || text?.align === 'right' || text?.align === 'center' ? text.align : 'center',
  };
}

export function resolveTextFontFamily(project: ProjectSpec | undefined, text: TextEntitySpec | undefined): string {
  const resolved = resolveTextEntityDefaults(text);
  if (resolved.fontFamily && resolved.fontFamily.trim().length > 0) return resolved.fontFamily.trim();
  const fonts = project?.assets?.fonts ?? {};
  const font = resolved.fontAssetId ? fonts[resolved.fontAssetId as Id] : undefined;
  const name = typeof font?.name === 'string' && font.name.trim().length > 0 ? font.name.trim() : undefined;
  if (name) return name;
  if (resolved.fontAssetId) return resolved.fontAssetId;
  return 'system-ui';
}

export function measureTextEntityPixels(
  project: ProjectSpec | undefined,
  text: TextEntitySpec | undefined
): { width: number; height: number } {
  const resolved = resolveTextEntityDefaults(text);
  const fontFamily = resolveTextFontFamily(project, resolved);
  const fontSize = resolved.fontSize;

  const lines = String(resolved.value ?? '').split('\n');
  const lineCount = Math.max(1, lines.length);
  const lineHeight = Math.max(1, Math.round(fontSize * 1.2));

  const context = getMeasureContext();
  if (!context) {
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const approxWidth = Math.max(1, Math.round(longest * fontSize * 0.6));
    const approxHeight = Math.max(1, lineCount * lineHeight);
    return { width: approxWidth, height: approxHeight };
  }

  context.font = `${fontSize}px ${fontFamily}`;
  let maxWidth = 1;
  for (const line of lines) {
    const metrics = context.measureText(line);
    const w = typeof metrics?.width === 'number' && Number.isFinite(metrics.width) ? metrics.width : 0;
    if (w > maxWidth) maxWidth = w;
  }
  return { width: Math.max(1, Math.ceil(maxWidth)), height: Math.max(1, lineCount * lineHeight) };
}

function getMeasureContext(): CanvasRenderingContext2D | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(1, 1) as any;
      const ctx = canvas.getContext?.('2d');
      return ctx ?? null;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return ctx;
    }
  } catch {
    // ignore
  }
  return null;
}

