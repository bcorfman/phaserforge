// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/imageMetadata', () => ({
  loadImageMetadataFromFile: vi.fn(async (_file: File, dataUrl: string) => ({
    src: dataUrl,
    name: 'demo',
    mimeType: 'image/png',
    width: 16,
    height: 16,
  })),
}));

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

  it('imports supported demo pack images and audio without a missing helper error', async () => {
    const dispatch = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const blob = url.endsWith('.mp3')
        ? new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
        : url.endsWith('.ogg')
          ? new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/ogg' })
          : url.endsWith('.wav')
            ? new Blob([new Uint8Array([7, 8, 9])], { type: 'audio/wav' })
            : url.endsWith('.woff2')
              ? new Blob([new Uint8Array([10, 11, 12])], { type: 'font/woff2' })
              : url.endsWith('.woff')
                ? new Blob([new Uint8Array([13, 14, 15])], { type: 'font/woff' })
                : url.endsWith('.ttf')
                  ? new Blob([new Uint8Array([16, 17, 18])], { type: 'font/ttf' })
                  : url.endsWith('.otf')
                    ? new Blob([new Uint8Array([19, 20, 21])], { type: 'font/otf' })
                    : new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      return {
        ok: true,
        blob: async () => blob,
      } as Response;
    });

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

      expect(fetchSpy).toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ensure-image-asset-from-file',
          file: expect.objectContaining({
            dataUrl: expect.stringContaining('data:image/png;base64,'),
            mimeType: 'image/png',
            width: 16,
            height: 16,
          }),
        }),
      );
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ensure-audio-asset-from-file',
          file: expect.objectContaining({
            dataUrl: expect.stringMatching(/^data:audio\/(mpeg|ogg|wav);base64,/),
          }),
        }),
      );
      expect(document.body.textContent).not.toContain('readUrlAsDataUrl is not defined');
      expect(document.body.textContent).not.toContain('Failed to import demo pack');
    } finally {
      fetchSpy.mockRestore();
      view.cleanup();
    }
  });
});
