// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { baseScene } from '../helpers';

describe('Attachment inspector: Spiral flip overrides', () => {
  it('shows flip override toggles and writes params.flipX/params.flipY', async () => {
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
      id: 'att-spiral-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'SpiralPattern',
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

    const flipX = container.querySelector('input[aria-label="Spiral Flip X"]') as HTMLInputElement | null;
    const flipY = container.querySelector('input[aria-label="Spiral Flip Y"]') as HTMLInputElement | null;
    expect(flipX).not.toBeNull();
    expect(flipY).not.toBeNull();
    expect(flipX!.checked).toBe(false);
    expect(flipY!.checked).toBe(false);

    await React.act(async () => {
      flipX!.click();
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]![0].params.flipX).toBe(true);

    await React.act(async () => {
      flipY!.click();
    });
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1]![0].params.flipY).toBe(true);
  });
});

