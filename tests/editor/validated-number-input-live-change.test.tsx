// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ValidatedNumberInput } from '../../src/editor/ValidatedNumberInput';

describe('ValidatedNumberInput live change', () => {
  it('emits live clamped values without waiting for blur', async () => {
    // Required for React's act() warnings under jsdom test environments.
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const onCommit = vi.fn();
    const onLiveChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <ValidatedNumberInput
          aria-label="Rotation"
          value={0}
          min={0}
          max={359}
          clamp={(next) => Math.max(0, Math.min(359, next || 0))}
          onCommit={onCommit}
          // NOTE: This behavior is required so arrow-step changes can update the canvas immediately.
          onLiveChange={onLiveChange}
        />
      );
    });

    const input = container.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await React.act(async () => {
      input!.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input!, '12');
      input!.dispatchEvent(new window.Event('input', { bubbles: true }));
      input!.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    expect(onLiveChange).toHaveBeenCalledWith(12);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
