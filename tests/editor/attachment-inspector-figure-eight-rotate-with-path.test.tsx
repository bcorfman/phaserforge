// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { baseScene } from '../helpers';

describe('Attachment inspector: Figure-8 rotateWithPath', () => {
  it('shows a rotate-with-path toggle and writes params.rotateWithPath', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const scene = baseScene();
    const project: any = {
      id: 'p1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {},
      initialSceneId: 'scene-1',
      counters: {},
      collections: {},
    };

    const attachment: any = {
      id: 'att-fig8-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'FigureEightPattern',
      enabled: true,
      order: 0,
      params: {},
    };

    const onUpdate = vi.fn();
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
          onUpdate,
          () => {}
        )
      );
    });

    const checkbox = container.querySelector('input[aria-label="Figure-8 Rotate With Path"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox!.checked).toBe(true);

    await React.act(async () => {
      checkbox!.click();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next = onUpdate.mock.calls[0]![0];
    expect(next.params.rotateWithPath).toBe(false);
  });
});

