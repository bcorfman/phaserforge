// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AssetsDock } from '../../src/editor/AssetsDock';

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function click(element: Element | null) {
  if (!(element instanceof HTMLElement)) throw new Error('Expected element to exist');
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AssetsDock demo pack import', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('imports supported demo pack assets as one path-backed batch', async () => {
    const dispatch = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const view = renderIntoDom(
      <AssetsDock
        project={{
          id: 'project-1',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
          inputMaps: {},
          scenes: { 'scene-1': { id: 'scene-1', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} } },
          initialSceneId: 'scene-1',
        } as any}
        sceneId="scene-1"
        selection={{ kind: 'none' } as any}
        dispatch={dispatch as any}
        disabled={false}
      />,
    );

    try {
      await click(document.querySelector('[data-testid="assets-dock-add-button"]'));
      await click(document.querySelector('[data-testid="assets-dock-add-menu-from-demo-pack"]'));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'import-demo-pack-assets',
          entries: expect.arrayContaining([
            expect.objectContaining({
              kind: 'image',
              path: 'assets/demo-pack/images/enemy_A.png',
              mimeType: 'image/png',
              width: 64,
              height: 64,
            }),
            expect.objectContaining({
              kind: 'audio',
              path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
              mimeType: 'audio/mpeg',
            }),
          ]),
        }),
      );
      expect(document.body.textContent).not.toContain('Failed to import demo pack');
    } finally {
      fetchSpy.mockRestore();
      view.cleanup();
    }
  });
});
