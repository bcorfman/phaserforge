// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { useInspectorFoldouts } from '../../src/editor/InspectorFoldout';

function Harness({ onValue }: { onValue: (value: string) => void }) {
  const foldouts = useInspectorFoldouts();
  const value = foldouts.isOpen('group.members', false) ? 'open' : 'closed';
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return <div data-testid="value">{value}</div>;
}

describe('useInspectorFoldouts test reset event', () => {
  it('reloads foldout state from localStorage when the test reset event fires', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const store = new Map<string, string>();
    const memoryStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });

    window.localStorage.setItem('phaserforge.inspectorFoldouts.v1', 'group.members: true\n');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const observed: string[] = [];

    await React.act(async () => {
      root.render(<Harness onValue={(v) => observed.push(v)} />);
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('open');

    window.localStorage.removeItem('phaserforge.inspectorFoldouts.v1');

    await React.act(async () => {
      window.dispatchEvent(new Event('phaserforge:test-reset-ui'));
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('closed');
    expect(observed).toEqual(expect.arrayContaining(['open', 'closed']));
  });
});
