// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EventsPanel } from '../../src/editor/EventsPanel';

describe('EventsPanel drag-drop nesting', () => {
  it('drops selected steps onto Repeat to nest them (and auto-expands)', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const project: any = { id: 'p1', assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} }, inputMaps: {}, scenes: {}, initialSceneId: 'scene-1' };
    const scene: any = {
      id: 'scene-1',
      world: { width: 800, height: 600 },
      entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
      groups: {},
      attachments: {
        rep: { id: 'rep', target: { type: 'entity', entityId: 'e1' }, presetId: 'Repeat', enabled: true, order: 0, params: { count: 2 }, children: ['child1'] },
        child1: { id: 'child1', target: { type: 'entity', entityId: 'e1' }, presetId: 'Wait', enabled: true, order: 0, parentAttachmentId: 'rep' },
        move: { id: 'move', target: { type: 'entity', entityId: 'e1' }, presetId: 'MoveXUntil', enabled: true, order: 1, params: { velocityX: 10 } },
      },
      behaviors: {},
      actions: {},
      conditions: {},
      eventBlocks: {},
    };

    const onNestUnderRepeat = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EventsPanel
          project={project}
          scene={scene}
          target={{ type: 'entity', entityId: 'e1' }}
          registry={{ arrange: [], actions: [], conditions: [] } as any}
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
          onNestAttachmentsUnderRepeat={onNestUnderRepeat as any}
        />
      );
    });

    // Collapse the repeat first (it currently has children)
    const collapse = container.querySelector('[data-testid="attachment-repeat-toggle-rep"]') as HTMLButtonElement | null;
    expect(collapse).not.toBeNull();
    await React.act(async () => {
      collapse!.click();
    });
    expect(container.querySelector('[data-testid="steps-children-wrap-rep"]')).toBeNull();

    // Select the move step
    const moveSelect = container.querySelector('input[aria-label="Select attachment move"]') as HTMLInputElement | null;
    expect(moveSelect).not.toBeNull();
    await React.act(async () => {
      moveSelect!.click();
    });

    // Drag move onto Repeat's nest target
    const dragBtn = container.querySelector('[data-testid="attachment-drag-move"]') as HTMLButtonElement | null;
    expect(dragBtn).not.toBeNull();
    const nestTarget = container.querySelector('button[aria-label="Nest under Repeat rep"]') as HTMLButtonElement | null;
    expect(nestTarget).not.toBeNull();

    const dt = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
    } as any;

    await React.act(async () => {
      const ev: any = new Event('dragstart', { bubbles: true });
      ev.dataTransfer = dt;
      dragBtn!.dispatchEvent(ev);
    });
    await React.act(async () => {
      const over: any = new Event('dragover', { bubbles: true });
      over.dataTransfer = dt;
      nestTarget!.dispatchEvent(over);
      const drop: any = new Event('drop', { bubbles: true });
      drop.dataTransfer = dt;
      nestTarget!.dispatchEvent(drop);
    });

    expect(onNestUnderRepeat).toHaveBeenCalledWith({ target: { type: 'entity', entityId: 'e1' }, eventId: undefined, repeatId: 'rep', attachmentIds: ['move'] });
  });
});
