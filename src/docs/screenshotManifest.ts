export type ScreenshotSource = 'storybook' | 'playwright';

type ScreenshotManifestEntryBase = {
  id: string;
  source: ScreenshotSource;
  output: string;
  selector?: string;
  viewport?: { width: number; height: number };
  note?: string;
};

export type StorybookScreenshotManifestEntry = ScreenshotManifestEntryBase & {
  source: 'storybook';
  storyId: string;
  readySelector?: string;
};

export type PlaywrightScreenshotManifestEntry = ScreenshotManifestEntryBase & {
  source: 'playwright';
  scene?: 'sample';
  capture?:
    | 'layout-popover'
    | 'selection-bar'
    | 'assets-dock'
    | 'assets-dock-demo-pack-menu'
    | 'assets-dock-demo-pack-loaded'
    | 'scene-graph-pattern-demo-sprites'
    | 'toolbar'
    | 'yaml-controls'
    | 'cloud-publish'
    | 'cloud-login'
    | 'cloud-signup'
    | 'cloud-account-linked'
    | 'actions-events'
    | 'wave-pattern-panel'
    | 'bounce-bounds-panel'
    | 'patrol-bounds-panel';
};

export type ScreenshotManifestEntry =
  | StorybookScreenshotManifestEntry
  | PlaywrightScreenshotManifestEntry;

function assertNonEmptyString(value: unknown, errorMessage: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
}

function parseViewport(value: unknown): { width: number; height: number } | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object') throw new Error('Screenshot manifest viewport must be an object');
  const width = Number((value as { width?: unknown }).width);
  const height = Number((value as { height?: unknown }).height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Screenshot manifest viewport must include positive width and height');
  }
  return { width, height };
}

export function parseScreenshotManifest(value: unknown): ScreenshotManifestEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('Screenshot manifest must be an array');
  }

  return value.map((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== 'object') {
      throw new Error('Screenshot manifest entries must be objects');
    }

    const entry = rawEntry as Record<string, unknown>;
    assertNonEmptyString(entry.id, 'Screenshot manifest entry must include a non-empty id');
    assertNonEmptyString(entry.source, `Screenshot manifest entry "${entry.id}" must include a source`);
    assertNonEmptyString(entry.output, `Screenshot manifest entry "${entry.id}" must include an output path`);

    const base: ScreenshotManifestEntryBase = {
      id: entry.id.trim(),
      source: entry.source as ScreenshotSource,
      output: entry.output.trim(),
      ...(typeof entry.selector === 'string' && entry.selector.trim().length > 0 ? { selector: entry.selector.trim() } : {}),
      ...(typeof entry.note === 'string' && entry.note.trim().length > 0 ? { note: entry.note.trim() } : {}),
      ...(entry.viewport ? { viewport: parseViewport(entry.viewport) } : {}),
    };

    if (base.source === 'storybook') {
      assertNonEmptyString(entry.storyId, `Screenshot manifest storybook entry "${base.id}" must include storyId`);
      return {
        ...base,
        source: 'storybook',
        storyId: entry.storyId.trim(),
        ...(typeof entry.readySelector === 'string' && entry.readySelector.trim().length > 0
          ? { readySelector: entry.readySelector.trim() }
          : {}),
      } satisfies StorybookScreenshotManifestEntry;
    }

    if (base.source === 'playwright') {
      return {
        ...base,
        source: 'playwright',
        ...(typeof entry.scene === 'string' ? { scene: entry.scene } : {}),
        ...(typeof entry.capture === 'string' ? { capture: entry.capture as PlaywrightScreenshotManifestEntry['capture'] } : {}),
      } satisfies PlaywrightScreenshotManifestEntry;
    }

    throw new Error(`Screenshot manifest entry "${base.id}" has unsupported source "${base.source}"`);
  });
}

export function getScreenshotsBySource<TSource extends ScreenshotSource>(
  manifest: ScreenshotManifestEntry[],
  source: TSource,
): Extract<ScreenshotManifestEntry, { source: TSource }>[] {
  return manifest.filter((entry): entry is Extract<ScreenshotManifestEntry, { source: TSource }> => entry.source === source);
}
