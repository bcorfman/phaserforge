// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { baseScene } from '../helpers';

function baseProject(): any {
  return {
    id: 'p1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {},
    initialSceneId: 'scene-1',
    counters: {},
    collections: {},
  };
}

describe('Attachment inspector back navigation', () => {
  it('invokes the provided back callback when clicked', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-back-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'WavePattern',
      enabled: true,
      order: 0,
      params: {},
    };

    const onBackToActionsEvents = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        renderAttachmentInspector(
          attachment,
          project,
          scene,
          { arrange: [], actions: [], conditions: [] } as any,
          () => {},
          () => {},
          onBackToActionsEvents
        )
      );
    });

    const backButton = container.querySelector('[data-testid="attachment-back-button"]') as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();

    await React.act(async () => {
      backButton!.click();
    });

    expect(onBackToActionsEvents).toHaveBeenCalledTimes(1);
  });
});

