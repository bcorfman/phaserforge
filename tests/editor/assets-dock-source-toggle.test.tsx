// @vitest-environment jsdom
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { AssetsDock } from '../../src/editor/AssetsDock';

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    root,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('AssetsDock source badge toggle', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('clicking Path badge embeds the asset from its path and preserves the path hint', async () => {
    const dispatch = vi.fn();
    const fetchMock = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = renderIntoDom(
      <AssetsDock
        project={{
          id: 'project-1',
          assets: { images: { img1: { id: 'img1', source: { kind: 'path', path: '/img.png' } } }, spriteSheets: {}, fonts: {} },
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
      const badge = Array.from(document.querySelectorAll('.assets-dock-badges .badge')).find((el) => el.textContent === 'Path') as HTMLElement | undefined;
      expect(badge).toBeTruthy();

      const flush = async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      };
      await act(async () => {
        badge!.click();
        await flush();
        await flush();
      });

      expect(fetchMock).toHaveBeenCalledWith('/img.png');
      for (let i = 0; i < 10 && dispatch.mock.calls.length === 0; i++) {
        await flush();
      }
      expect(dispatch.mock.calls.length).toBeGreaterThan(0);
      const action = dispatch.mock.calls.find((c) => c[0]?.type === 'relink-asset-source')?.[0];
      expect(action).toMatchObject({ type: 'relink-asset-source', assetKind: 'image', assetId: 'img1', source: { kind: 'embedded', path: '/img.png', mimeType: 'image/png' } });
      expect(String(action.source.dataUrl)).toContain('data:image/png');
    } finally {
      view.cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('clicking Embedded badge switches to path-only and discards embedded data', async () => {
    const dispatch = vi.fn();
    const view = renderIntoDom(
      <AssetsDock
        project={{
          id: 'project-1',
          assets: { images: { img1: { id: 'img1', source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', path: '/img.png', mimeType: 'image/png' } } }, spriteSheets: {}, fonts: {} },
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
      const badge = Array.from(document.querySelectorAll('.assets-dock-badges .badge')).find((el) => el.textContent === 'Embedded') as HTMLElement | undefined;
      expect(badge).toBeTruthy();

      act(() => badge!.click());

      const action = dispatch.mock.calls.find((c) => c[0]?.type === 'relink-asset-source')?.[0];
      expect(action).toEqual({ type: 'relink-asset-source', assetKind: 'image', assetId: 'img1', source: { kind: 'path', path: '/img.png' } });
    } finally {
      view.cleanup();
    }
  });

  it('clicking Embedded badge without a stored path reports an error', async () => {
    const dispatch = vi.fn();
    const view = renderIntoDom(
      <AssetsDock
        project={{
          id: 'project-1',
          assets: { images: { img1: { id: 'img1', source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' } } }, spriteSheets: {}, fonts: {} },
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
      const badge = Array.from(document.querySelectorAll('.assets-dock-badges .badge')).find((el) => el.textContent === 'Embedded') as HTMLElement | undefined;
      expect(badge).toBeTruthy();

      act(() => badge!.click());

      const action = dispatch.mock.calls.find((c) => c[0]?.type === 'set-error')?.[0];
      expect(action?.error).toMatch(/no path/i);
    } finally {
      view.cleanup();
    }
  });
});
