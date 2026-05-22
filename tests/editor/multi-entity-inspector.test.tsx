// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MultiEntityInspector } from '../../src/editor/MultiEntityInspector';

describe('MultiEntityInspector', () => {
  it('disables non-applicable fields and bulk-edits common fields', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const dispatch = vi.fn();
    const scene: any = {
      id: 'scene-1',
      entities: {
        a: { id: 'a', x: 10, y: 10, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
        b: { id: 'b', x: 20, y: 20, width: 10, height: 10, scaleX: 2, scaleY: 1, visible: false },
      },
      groups: {},
      attachments: {},
      behaviors: {},
      actions: {},
      conditions: {},
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <MultiEntityInspector
          entityIds={['a', 'b']}
          scene={scene}
          dispatch={dispatch}
          disabled={false}
          assetOptions={[]}
        />
      );
    });

    const x = container.querySelector('[data-testid="entity-x-input"]') as HTMLInputElement | null;
    expect(x).not.toBeNull();
    expect(x!.disabled).toBe(true);

    const scaleX = container.querySelector('[data-testid="entity-scale-x-input"]') as HTMLInputElement | null;
    expect(scaleX).not.toBeNull();
    expect(scaleX!.getAttribute('placeholder')).toBe('Mixed');

    await React.act(async () => {
      scaleX!.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(scaleX!, '3');
      scaleX!.dispatchEvent(new window.Event('input', { bubbles: true }));
      scaleX!.dispatchEvent(new window.Event('change', { bubbles: true }));
      scaleX!.blur();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'patch-entities',
      entityIds: ['a', 'b'],
      patch: { scaleX: 3 },
    });

    const visible = container.querySelector('[data-testid="entity-visible-input"]') as HTMLInputElement | null;
    expect(visible).not.toBeNull();
    expect(visible!.indeterminate).toBe(true);
  });
});
