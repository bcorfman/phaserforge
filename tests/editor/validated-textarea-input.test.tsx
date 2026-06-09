// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ValidatedTextareaInput } from '../../src/editor/ValidatedNumberInput';

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  textarea.dispatchEvent(new window.Event('change', { bubbles: true }));
}

describe('ValidatedTextareaInput', () => {
  it('emits live text changes before commit', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const onCommit = vi.fn();
    const onLiveChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <ValidatedTextareaInput
          aria-label="Text Content"
          value="Hello"
          onCommit={onCommit}
          onLiveChange={onLiveChange}
        />
      );
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await React.act(async () => {
      textarea!.focus();
      setTextareaValue(textarea!, 'Hello world');
    });

    expect(onLiveChange).toHaveBeenCalledWith('Hello world');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reverts to the starting value on Escape', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const onCommit = vi.fn();
    const onLiveChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <ValidatedTextareaInput
          aria-label="Text Content"
          value="Hello"
          onCommit={onCommit}
          onLiveChange={onLiveChange}
        />
      );
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await React.act(async () => {
      textarea!.focus();
      setTextareaValue(textarea!, 'Goodbye');
      textarea!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onLiveChange).toHaveBeenLastCalledWith('Hello');
    expect(onCommit).toHaveBeenCalledWith('Hello');
  });
});
