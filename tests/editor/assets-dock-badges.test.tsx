// @vitest-environment jsdom
import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

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

describe('AssetsDock badges', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('does not render source badges for embedded assets', () => {
    const view = renderIntoDom(
      <AssetsDock
        project={{
          id: 'project-1',
          assets: {
            images: {
              img1: {
                id: 'img1',
                source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', originalName: 'spaceship.png', mimeType: 'image/png' },
              },
            },
            spriteSheets: {},
            fonts: {},
          },
          audio: { sounds: {} },
          inputMaps: {},
          scenes: { 'scene-1': { id: 'scene-1', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} } },
          initialSceneId: 'scene-1',
        } as any}
        sceneId="scene-1"
        selection={{ kind: 'none' } as any}
        dispatch={(() => {}) as any}
        disabled={false}
      />,
    );
    try {
      const badges = Array.from(document.querySelectorAll('.assets-dock-badges .badge')).map((el) => el.textContent?.trim());
      expect(badges).not.toContain('Embedded');
      expect(badges).not.toContain('Path');
    } finally {
      view.cleanup();
    }
  });
});
