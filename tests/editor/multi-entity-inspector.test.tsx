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

    const tint = container.querySelector('[data-testid="entity-tint-hex-input"]') as HTMLInputElement | null;
    expect(tint).not.toBeNull();
    await React.act(async () => {
      tint!.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(tint!, '#224466');
      tint!.dispatchEvent(new window.Event('input', { bubbles: true }));
      tint!.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'patch-entities',
      entityIds: ['a', 'b'],
      patch: { tint: 0x224466 },
    });
  });

  it('commits the latest typed value when blur happens immediately after editing another field', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const dispatch = vi.fn();
    const scene: any = {
      id: 'scene-1',
      entities: {
        a: { id: 'a', x: 10, y: 10, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
        b: { id: 'b', x: 20, y: 20, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
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

    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    };

    const scaleX = container.querySelector('[data-testid="entity-scale-x-input"]') as HTMLInputElement | null;
    const scaleY = container.querySelector('[data-testid="entity-scale-y-input"]') as HTMLInputElement | null;
    expect(scaleX).not.toBeNull();
    expect(scaleY).not.toBeNull();

    await React.act(async () => {
      scaleX!.focus();
      setInputValue(scaleX!, '1.25');
      scaleX!.blur();

      scaleY!.focus();
      setInputValue(scaleY!, '0.75');
      scaleY!.blur();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'patch-entities',
      entityIds: ['a', 'b'],
      patch: { scaleY: 0.75 },
    });
  });

  it('commits the latest typed value on Enter before focus moves to the next field', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const dispatch = vi.fn();
    const scene: any = {
      id: 'scene-1',
      entities: {
        a: { id: 'a', x: 10, y: 10, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
        b: { id: 'b', x: 20, y: 20, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
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

    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    };

    const scaleX = container.querySelector('[data-testid="entity-scale-x-input"]') as HTMLInputElement | null;
    const scaleY = container.querySelector('[data-testid="entity-scale-y-input"]') as HTMLInputElement | null;
    expect(scaleX).not.toBeNull();
    expect(scaleY).not.toBeNull();

    await React.act(async () => {
      scaleX!.focus();
      setInputValue(scaleX!, '1.25');
      scaleX!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      scaleY!.focus();
      setInputValue(scaleY!, '0.75');
      scaleY!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'patch-entities',
      entityIds: ['a', 'b'],
      patch: { scaleX: 1.25 },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'patch-entities',
      entityIds: ['a', 'b'],
      patch: { scaleY: 0.75 },
    });
  });

  it('keeps a focused scale field stable across a parent rerender during sequential edits', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      const [tick, setTick] = React.useState(0);
      const [scene, setScene] = React.useState<any>({
        id: 'scene-1',
        entities: {
          a: { id: 'a', x: 10, y: 10, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
          b: { id: 'b', x: 20, y: 20, width: 10, height: 10, scaleX: 1, scaleY: 1, visible: true },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      });

      return (
        <>
          <button type="button" data-testid="rerender" onClick={() => setTick((value) => value + 1)}>
            rerender {tick}
          </button>
          <MultiEntityInspector
            entityIds={['a', 'b']}
            scene={scene}
            disabled={false}
            assetOptions={[]}
            dispatch={(action) => {
              if (action.type !== 'patch-entities') return;
              setScene((prev: any) => ({
                ...prev,
                entities: Object.fromEntries(
                  Object.entries(prev.entities).map(([id, entity]) => [
                    id,
                    action.entityIds.includes(id)
                      ? { ...(entity as Record<string, unknown>), ...action.patch }
                      : entity,
                  ])
                ),
              }));
            }}
          />
        </>
      );
    }

    await React.act(async () => {
      root.render(<Harness />);
    });

    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    };

    const scaleX = container.querySelector('[data-testid="entity-scale-x-input"]') as HTMLInputElement | null;
    const scaleY = container.querySelector('[data-testid="entity-scale-y-input"]') as HTMLInputElement | null;
    const rerenderButton = container.querySelector('[data-testid="rerender"]') as HTMLButtonElement | null;
    expect(scaleX).not.toBeNull();
    expect(scaleY).not.toBeNull();
    expect(rerenderButton).not.toBeNull();

    await React.act(async () => {
      scaleX!.focus();
      setInputValue(scaleX!, '1.25');
      scaleX!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      scaleY!.focus();
      rerenderButton!.click();
      setInputValue(scaleY!, '0.75');
      scaleY!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const scaleXAfter = container.querySelector('[data-testid="entity-scale-x-input"]') as HTMLInputElement | null;
    const scaleYAfter = container.querySelector('[data-testid="entity-scale-y-input"]') as HTMLInputElement | null;
    expect(scaleXAfter?.value).toBe('1.25');
    expect(scaleYAfter?.value).toBe('0.75');
  });
});
