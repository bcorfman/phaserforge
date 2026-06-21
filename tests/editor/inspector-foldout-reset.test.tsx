// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { useInspectorFoldouts } from '../../src/editor/InspectorFoldout';

const persistence = vi.hoisted(() => ({
  loadPreferencesRecord: vi.fn(async () => ({ inspectorFoldouts: {} })),
  updatePreferencesRecord: vi.fn(async () => ({})),
}));

vi.mock('../../src/editor/projectPersistence', () => ({
  projectPersistence: persistence,
}));

function Harness({ onValue }: { onValue: (value: string) => void }) {
  const foldouts = useInspectorFoldouts();
  const value = foldouts.isOpen('group.members', false) ? 'open' : 'closed';
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return <div data-testid="value">{value}</div>;
}

describe('useInspectorFoldouts test reset event', () => {
  it('reloads foldout state from persistence when the test reset event fires', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const store = { inspectorFoldouts: { 'group.members': true } };
    persistence.loadPreferencesRecord.mockImplementation(async () => store);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const observed: string[] = [];

    await React.act(async () => {
      root.render(<Harness onValue={(v) => observed.push(v)} />);
    });

    await React.act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('open');

    store.inspectorFoldouts = {};

    await React.act(async () => {
      window.dispatchEvent(new Event('phaserforge:test-reset-ui'));
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('closed');
    expect(observed).toEqual(expect.arrayContaining(['open', 'closed']));
  });
});
