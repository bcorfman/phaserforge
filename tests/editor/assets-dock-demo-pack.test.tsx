// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/imageMetadata', () => ({
  loadImageMetadataFromFile: vi.fn(async (_file: File, dataUrl: string) => ({
    src: dataUrl,
    name: 'demo.png',
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

  it('imports demo pack images without a missing helper error', async () => {
    const dispatch = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
    } as Response);

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
      expect(document.body.textContent).not.toContain('readUrlAsDataUrl is not defined');
      expect(document.body.textContent).not.toContain('Failed to import demo pack');
    } finally {
      fetchSpy.mockRestore();
      view.cleanup();
    }
  });
});
