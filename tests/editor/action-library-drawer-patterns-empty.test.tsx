// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ActionLibraryDrawer } from '../../src/editor/ActionLibraryDrawer';

describe('ActionLibraryDrawer patterns category', () => {
  it('auto-switches away from Patterns when there are no patterns', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const onSelectCategory = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <ActionLibraryDrawer
          open
          title="Add Step"
          actions={[]}
          patterns={[]}
          pinnedTypes={new Set()}
          onTogglePin={() => {}}
          pinnedPatternIds={new Set()}
          onTogglePinnedPattern={() => {}}
          selectedCategory="Patterns"
          onSelectCategory={onSelectCategory}
          onPickAction={() => {}}
          onPickPattern={() => {}}
          onClose={() => {}}
        />
      );
    });

    expect(onSelectCategory).toHaveBeenCalledWith('All');
  });
});

