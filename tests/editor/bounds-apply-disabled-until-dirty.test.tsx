// @vitest-environment jsdom
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
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

async function setNumberInputByTestId(testId: string, next: string) {
  const input = document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | null;
  expect(input).toBeTruthy();
  await act(async () => {
    input!.focus();
    input!.dispatchEvent(new FocusEvent('focusin', { bubbles: true, cancelable: true }));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, next);
    else input!.value = next;
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true }));
    input!.blur();
    await Promise.resolve();
  });
}

describe('Bounds panels', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('disables BoundsHelperPanel Apply until values change', async () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'ZigzagPattern',
      enabled: true,
      order: 0,
      condition: {
        type: 'BoundsHit',
        bounds: { minX: 10, minY: 20, maxX: 30, maxY: 40 },
        mode: 'any',
        scope: 'member-any',
        behavior: 'limit',
      },
      params: { width: 30, height: 15, velocity: 100, segments: 12 },
    };

    const onUpdate = vi.fn();
    const view = renderIntoDom(
      renderAttachmentInspector(attachment, project, scene, { arrange: [], actions: [], conditions: [] }, onUpdate, () => {})
    );

    try {
      const apply = document.querySelector('[data-testid="bounds-helper-apply"]') as HTMLButtonElement | null;
      expect(apply).toBeTruthy();
      expect(apply!.disabled).toBe(true);

      await setNumberInputByTestId('bounds-helper-xspan', '10');
      expect(apply!.disabled).toBe(false);
    } finally {
      view.cleanup();
    }
  });

  it('disables Bounce Center/Span Apply until values change', async () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-2',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'BouncePattern',
      enabled: true,
      order: 0,
      condition: {
        type: 'BoundsHit',
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        mode: 'any',
        scope: 'member-any',
        behavior: 'bounce',
      },
      params: { velocityX: 120, velocityY: 60, axis: 'both' },
    };

    const onUpdate = vi.fn();
    const view = renderIntoDom(
      renderAttachmentInspector(attachment, project, scene, { arrange: [], actions: [], conditions: [] }, onUpdate, () => {})
    );

    try {
      const centerspan = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Center/Span') as HTMLButtonElement | undefined;
      expect(centerspan).toBeTruthy();
      act(() => centerspan!.click());

      await setNumberInputByTestId('bounce-bounds-helper-xspan', '25');
      const apply = document.querySelector('[data-testid="bounce-bounds-centerspan-apply"]') as HTMLButtonElement | null;
      expect(apply).toBeFalsy();

      const last = onUpdate.mock.calls.at(-1)?.[0];
      expect(last?.condition?.bounds).toEqual({ minX: 25, minY: 0, maxX: 75, maxY: 100 });
    } finally {
      view.cleanup();
    }
  });
});
