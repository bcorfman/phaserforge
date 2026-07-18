// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { EventsPanel } from '../../src/editor/EventsPanel';
import { sampleProject } from '../../src/model/sampleProject';
import { baseScene } from '../helpers';

const registry = {
  arrange: [],
  actions: [
    { type: 'SetProperty', displayName: 'Set Property', category: 'state', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
  ],
  conditions: [],
};

function installMockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => void store.clear(),
    },
    configurable: true,
  });
}

async function renderBoundsPanel(behavior: 'wrap' | 'bounce' | 'limit' | 'stop') {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  installMockLocalStorage();
  const scene = baseScene();
  scene.groups.g1.layout = { type: 'freeform' };
  scene.eventBlocks = {
    wrap: {
      id: 'wrap',
      target: { type: 'group', groupId: 'g1' },
      trigger: { type: 'bounds', boundsEvent: behavior === 'bounce' ? 'bounced' : 'wrapped', axis: 'y', side: 'bottom' },
    } as any,
  };
  scene.attachments = {
    move: {
      id: 'move',
      target: { type: 'group', groupId: 'g1' },
      presetId: 'MoveUntil',
      condition: {
        type: 'BoundsHit',
        mode: 'any',
        scope: 'member-any',
        behavior,
        bounds: { minX: 0, maxX: 720, minY: 0, maxY: 1280 },
      },
    } as any,
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onUpdateEventBlock = vi.fn();
  await React.act(async () => {
    root.render(
      <EventsPanel
        project={sampleProject}
        scene={scene}
        target={{ type: 'group', groupId: 'g1' }}
        selectedAttachmentId={undefined}
        registry={registry as any}
        onCreateEventBlock={() => {}}
        onUpdateEventBlock={onUpdateEventBlock}
        onRemoveEventBlock={() => {}}
        onAddAttachment={() => {}}
        onSelectAttachment={() => {}}
        onMoveAttachment={() => {}}
        onReorderAttachments={() => {}}
        onNestAttachmentsUnderRepeat={() => {}}
        onRemoveAttachment={() => {}}
        onMakeParallel={() => {}}
        onUngroupParallel={() => {}}
        onMoveParallelGroup={() => {}}
        onCreatePatternFromAttachments={() => {}}
        onApplyPattern={() => {}}
        onApplyLoopTemplate={() => {}}
      />
    );
  });

  return { container, root, onUpdateEventBlock };
}

describe('EventsPanel bounds event metadata', () => {
  it('filters finite bounds outcomes when the selected target has a known Bounds behavior', async () => {
    const { container, root } = await renderBoundsPanel('wrap');
    const options = Array.from(container.querySelectorAll('[data-testid="event-bounds-event-wrap"] option')).map((option) => option.getAttribute('value'));
    expect(options).toEqual(['contact-entered', 'contact-exited', 'wrapped']);
    expect(container.querySelector('[data-testid="event-bounds-description-wrap"]')?.textContent).toContain('opposite boundary');
    expect(container.querySelector('[data-testid="event-bounds-compatibility-wrap"]')?.textContent).toContain('Compatible with Wrap');
    await React.act(async () => root.unmount());
  });

  it('uses side labels from the shared runtime event metadata', async () => {
    const { container, root } = await renderBoundsPanel('bounce');
    const labels = Array.from(container.querySelectorAll('[data-testid="event-bounds-side-wrap"] option')).map((option) => option.textContent);
    expect(labels).toEqual(['Any', 'Left / Min X', 'Right / Max X', 'Bottom / Min Y', 'Top / Max Y']);
    expect(container.querySelector('[data-testid="event-bounds-compatibility-wrap"]')?.textContent).toContain('Compatible with Bounce');
    await React.act(async () => root.unmount());
  });
});
