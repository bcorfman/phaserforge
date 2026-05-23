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
    { type: 'WavePattern', displayName: 'Wave Pattern', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
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
    window.localStorage.removeItem('phaserforge.pinnedActionTypes.v1');

    const onAddAttachment = vi.fn();
    const onApplyLoopTemplate = vi.fn();
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
          onApplyLoopTemplate={onApplyLoopTemplate as any}
        />
      );
    });

    const openButton = container.querySelector('[data-testid="event-add-open"]') as HTMLButtonElement | null;
    expect(openButton).not.toBeNull();

    await React.act(async () => {
      openButton!.click();
    });

    expect(container.querySelector('[data-testid="action-library"]')).not.toBeNull();

    const pinMoveUntil = container.querySelector('[data-testid="action-library-pin-MoveUntil"]') as HTMLButtonElement | null;
    expect(pinMoveUntil).not.toBeNull();

    await React.act(async () => {
      pinMoveUntil!.click();
    });

    // Pinned section should appear after pinning.
    expect(container.textContent).toContain('Pinned (filtered)');

    const addWait = container.querySelector('[data-testid="action-library-add-Wait"]') as HTMLElement | null;
    expect(addWait).not.toBeNull();

    await React.act(async () => {
      addWait!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    // Drawer closes after picking.
    expect(container.querySelector('[data-testid="action-library"]')).toBeNull();
    expect(onAddAttachment).toHaveBeenCalledWith('Wait', expect.objectContaining({ eventId: undefined }));
  });

  it('strips Pattern suffix from movement actions in the drawer', async () => {
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
          onApplyLoopTemplate={() => {}}
        />
      );
    });

    const openButton = container.querySelector('[data-testid="event-add-open"]') as HTMLButtonElement | null;
    expect(openButton).not.toBeNull();
    await React.act(async () => {
      openButton!.click();
    });

    const movementTab = container.querySelector('[data-testid="action-library-cat-movement"]') as HTMLButtonElement | null;
    expect(movementTab).not.toBeNull();
    await React.act(async () => {
      movementTab!.click();
    });

    expect(container.textContent).toContain('Wave');
    expect(container.textContent).not.toContain('Wave Pattern');
    expect(container.textContent).not.toContain('WavePattern');
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
          onApplyLoopTemplate={() => {}}
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
          onApplyLoopTemplate={() => {}}
        />
      );
    });

    // The mockup removed the inline filter box; ensure steps still render.
    expect(container.querySelector('[data-testid="attachment-open-att-wait-right"]')).not.toBeNull();
  });

  it('opens Repeat with Children prompt and applies template with opts', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();

    const onApplyLoopTemplate = vi.fn();
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
          onApplyLoopTemplate={onApplyLoopTemplate as any}
        />
      );
    });

    const openButton = container.querySelector('[data-testid="event-add-open"]') as HTMLButtonElement | null;
    expect(openButton).not.toBeNull();
    await React.act(async () => {
      openButton!.click();
    });

    const loopsTab = container.querySelector('[data-testid="action-library-cat-loops"]') as HTMLButtonElement | null;
    expect(loopsTab).not.toBeNull();
    await React.act(async () => {
      loopsTab!.click();
    });

    const addRepeatWithChildren = container.querySelector('[data-testid="action-library-add-loops:repeat_with_children"]') as HTMLElement | null;
    expect(addRepeatWithChildren).not.toBeNull();
    await React.act(async () => {
      addRepeatWithChildren!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="repeat-with-children-prompt"]')).not.toBeNull();

    const createBtn = container.querySelector('[data-testid="repeat-children-create"]') as HTMLButtonElement | null;
    expect(createBtn).not.toBeNull();
    await React.act(async () => {
      createBtn!.click();
    });

    expect(onApplyLoopTemplate).toHaveBeenCalledWith(
      'loops:repeat_with_children',
      undefined,
      expect.objectContaining({ childCount: 2 })
    );
  });

  it('removes a step via the overflow menu (ellipsis button)', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMockLocalStorage();

    const onRemoveAttachment = vi.fn();
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
          onRemoveAttachment={onRemoveAttachment}
          onMakeParallel={() => {}}
          onUngroupParallel={() => {}}
          onMoveParallelGroup={() => {}}
          onCreatePatternFromAttachments={() => {}}
          onApplyPattern={() => {}}
          onApplyLoopTemplate={() => {}}
        />
      );
    });

    const menuButton = container.querySelector('[data-testid="attachment-menu-att-wait-right"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();

    await React.act(async () => {
      menuButton!.click();
    });

    const removeItem = container.querySelector('[data-testid="attachment-menu-remove-att-wait-right"]') as HTMLButtonElement | null;
    expect(removeItem).not.toBeNull();

    await React.act(async () => {
      removeItem!.click();
    });

    expect(onRemoveAttachment).toHaveBeenCalledWith('att-wait-right');
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
          onApplyLoopTemplate={() => {}}
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
