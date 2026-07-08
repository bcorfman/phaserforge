import { describe, expect, it } from 'vitest';

import { buildAssetFileName, sanitizeAssetStem } from '../../vite/assetFileNames.mjs';

describe('vite asset file names', () => {
  it('sanitizes demo-pack audio names for pages-safe output paths', () => {
    expect(sanitizeAssetStem('sb_indreams(chosic.com).mp3')).toBe('sb_indreams-chosic.com');
    expect(sanitizeAssetStem('punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3'))
      .toBe('punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix-chosic.com');
  });

  it('builds hashed asset paths without raw parentheses', () => {
    expect(buildAssetFileName({ name: 'sb_indreams(chosic.com).mp3' })).toBe('assets/sb_indreams-chosic.com-[hash][extname]');
  });
});
