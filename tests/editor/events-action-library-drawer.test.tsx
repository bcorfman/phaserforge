// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EventsPanel } from '../../src/editor/EventsPanel';
import { sampleProject } from '../../src/model/sampleProject';
import { sampleScene } from '../../src/model/sampleScene';

function installMockLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true });
  return localStorage;
}

const registry = {
  arrange: [],
  actions: [
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'MoveXUntil', displayName: 'Move X Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'MoveYUntil', displayName: 'Move Y Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Wait', displayName: 'Wait', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Call', displayName: 'Call', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'EmitEvent', displayName: 'Emit Event', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Repeat', displayName: 'Repeat', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'BlinkUntil', displayName: 'Blink Until', category: 'visual', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'CycleFramesUntil', displayName: 'Cycle Frames Until', category: 'visual', targetKinds: ['entity', 'group'], implemented: true },
  ],
  conditions: [],
};

describe('EventsPanel Action Library drawer', () => {
  it('opens drawer, toggles pin, and picks an action', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();
    window.localStorage.removeItem('phaseractions.pinnedActionTypes.v1');

    const onAddAttachment = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EventsPanel
          project={sampleProject}
          scene={sampleScene}
          target={{ type: 'group', groupId: 'g-enemies' }}
          selectedAttachmentId={undefined}
          registry={registry as any}
          onCreateEventBlock={() => {}}
          onUpdateEventBlock={() => {}}
          onRemoveEventBlock={() => {}}
          onAddAttachment={onAddAttachment}
          onSelectAttachment={() => {}}
          onMoveAttachment={() => {}}
          onReorderAttachments={() => {}}
          onRemoveAttachment={() => {}}
          onMakeParallel={() => {}}
          onUngroupParallel={() => {}}
          onMoveParallelGroup={() => {}}
          onCreatePatternFromAttachments={() => {}}
          onApplyPattern={() => {}}
        />
      );
    });

    const openButton = container.querySelector('[data-testid="event-add-open"]') as HTMLButtonElement | null;
    expect(openButton).not.toBeNull();

    await React.act(async () => {
      openButton!.click();
    });

    const newAction = container.querySelector('[data-testid="event-add-new-action"]') as HTMLButtonElement | null;
    expect(newAction).not.toBeNull();

    await React.act(async () => {
      newAction!.click();
    });

    expect(container.querySelector('[data-testid="action-library"]')).not.toBeNull();

    const pinMoveUntil = container.querySelector('[data-testid="action-library-pin-MoveUntil"]') as HTMLButtonElement | null;
    expect(pinMoveUntil).not.toBeNull();

    await React.act(async () => {
      pinMoveUntil!.click();
    });

    // Pinned section should appear after pinning.
    expect(container.textContent).toContain('Pinned (global)');

    const addWait = container.querySelector('[data-testid="action-library-add-Wait"]') as HTMLElement | null;
    expect(addWait).not.toBeNull();

    await React.act(async () => {
      addWait!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    // Drawer closes after picking.
    expect(container.querySelector('[data-testid="action-library"]')).toBeNull();
    expect(onAddAttachment).toHaveBeenCalledWith('Wait', expect.objectContaining({ eventId: undefined }));
  });

  it('uses OnSceneStart label for start-trigger blocks', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EventsPanel
          project={sampleProject}
          scene={sampleScene}
          target={{ type: 'group', groupId: 'g-enemies' }}
          selectedAttachmentId={undefined}
          registry={registry as any}
          onCreateEventBlock={() => {}}
          onUpdateEventBlock={() => {}}
          onRemoveEventBlock={() => {}}
          onAddAttachment={() => {}}
          onSelectAttachment={() => {}}
          onMoveAttachment={() => {}}
          onReorderAttachments={() => {}}
          onRemoveAttachment={() => {}}
          onMakeParallel={() => {}}
          onUngroupParallel={() => {}}
          onMoveParallelGroup={() => {}}
          onCreatePatternFromAttachments={() => {}}
          onApplyPattern={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('OnSceneStart');
  });

  it('filters step rendering from the Filter input', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EventsPanel
          project={sampleProject}
          scene={sampleScene}
          target={{ type: 'group', groupId: 'g-enemies' }}
          selectedAttachmentId={undefined}
          registry={registry as any}
          onCreateEventBlock={() => {}}
          onUpdateEventBlock={() => {}}
          onRemoveEventBlock={() => {}}
          onAddAttachment={() => {}}
          onSelectAttachment={() => {}}
          onMoveAttachment={() => {}}
          onReorderAttachments={() => {}}
          onRemoveAttachment={() => {}}
          onMakeParallel={() => {}}
          onUngroupParallel={() => {}}
          onMoveParallelGroup={() => {}}
          onCreatePatternFromAttachments={() => {}}
          onApplyPattern={() => {}}
        />
      );
    });

    // Sanity: the "Pause" step exists in sampleScene.
    expect(container.querySelector('[data-testid="attachment-open-att-wait-right"]')).not.toBeNull();

    const filterInput = container.querySelector('[data-testid="event-action-filter"]') as HTMLInputElement | null;
    expect(filterInput).not.toBeNull();

    await React.act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(filterInput!, 'Move');
      filterInput!.dispatchEvent(new window.Event('input', { bubbles: true }));
      filterInput!.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // "Pause" rows should be hidden by the filter (Move matches Move Left/Right only).
    expect(container.querySelector('[data-testid="attachment-open-att-wait-right"]')).toBeNull();
  });

  it('drag-to-reorder calls onReorderAttachments with new order', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();

    const onReorderAttachments = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EventsPanel
          project={sampleProject}
          scene={sampleScene}
          target={{ type: 'group', groupId: 'g-enemies' }}
          selectedAttachmentId={undefined}
          registry={registry as any}
          onCreateEventBlock={() => {}}
          onUpdateEventBlock={() => {}}
          onRemoveEventBlock={() => {}}
          onAddAttachment={() => {}}
          onSelectAttachment={() => {}}
          onMoveAttachment={() => {}}
          onReorderAttachments={onReorderAttachments}
          onRemoveAttachment={() => {}}
          onMakeParallel={() => {}}
          onUngroupParallel={() => {}}
          onMoveParallelGroup={() => {}}
          onCreatePatternFromAttachments={() => {}}
          onApplyPattern={() => {}}
        />
      );
    });

    const drag = container.querySelector('[data-testid="attachment-drag-att-wait-left"]') as HTMLButtonElement | null;
    expect(drag).not.toBeNull();

    const dropZone = container.querySelector('[data-testid="attachment-dropzone-att-move-right"]') as HTMLElement | null;
    expect(dropZone).not.toBeNull();

    const dragStart: any = new window.Event('dragstart', { bubbles: true });
    dragStart.dataTransfer = { setData: () => {}, effectAllowed: 'move' };

    const drop: any = new window.Event('drop', { bubbles: true });
    drop.dataTransfer = { dropEffect: 'move' };

    await React.act(async () => {
      drag!.dispatchEvent(dragStart);
    });
    await React.act(async () => {
      dropZone!.dispatchEvent(drop);
    });

    expect(onReorderAttachments).toHaveBeenCalled();
    expect(onReorderAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        parentAttachmentId: 'att-loop',
        orderedAttachmentIds: expect.arrayContaining(['att-wait-left', 'att-move-right']),
      })
    );
  });
});
