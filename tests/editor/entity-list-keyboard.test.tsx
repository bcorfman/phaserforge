// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleProject } from '../../src/model/sampleProject';

function renderEntityList(props: Partial<React.ComponentProps<typeof EntityListView>> = {}) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const dispatch = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const baseProps: React.ComponentProps<typeof EntityListView> = {
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
    scene: sampleProject.scenes[sampleProject.initialSceneId],
    selection: { kind: 'none' },
    sidebarScope: 'scene',
    expandedGroups: { 'g-enemies': false },
    mode: 'edit',
    dispatch,
  };

  return {
    container,
    root,
    dispatch,
    props: { ...baseProps, ...props } as React.ComponentProps<typeof EntityListView>,
  };
}

describe('EntityList keyboard shortcuts', () => {
  it('ArrowDown selects the next ungrouped sprite when a sprite row is focused', async () => {
    const project = {
      ...sampleProject,
      scenes: {
        ...sampleProject.scenes,
        [sampleProject.initialSceneId]: {
          ...(sampleProject.scenes[sampleProject.initialSceneId] as any),
          entities: {
            ...(sampleProject.scenes[sampleProject.initialSceneId] as any).entities,
            entity: { id: 'entity', x: 10, y: 10, width: 10, height: 10 },
            entity2: { id: 'entity2', x: 20, y: 20, width: 10, height: 10 },
          },
        },
      },
    };

    const { container, root, dispatch, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
      selection: { kind: 'entity', id: 'entity' } as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const first = container.querySelector('[data-testid="ungrouped-entity-entity"]') as HTMLButtonElement | null;
    expect(first).not.toBeNull();

    await React.act(async () => {
      first!.focus();
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'select', selection: { kind: 'entity', id: 'entity2' } });
  });

  it('F2 enters rename mode for a selected trigger zone when its row is focused', async () => {
    const project = {
      ...sampleProject,
      scenes: {
        ...sampleProject.scenes,
        [sampleProject.initialSceneId]: {
          ...(sampleProject.scenes[sampleProject.initialSceneId] as any),
          triggers: [{ id: 't1', name: 'Zone 1', type: 'rect', minX: 0, minY: 0, maxX: 10, maxY: 10 }],
        },
      },
    };

    const { container, root, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
      selection: { kind: 'trigger', id: 't1' } as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const row = container.querySelector('[data-testid="trigger-zone-t1"]') as HTMLButtonElement | null;
    expect(row).not.toBeNull();

    await React.act(async () => {
      row!.focus();
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    });

    const input = container.querySelector('[data-testid="rename-trigger-input-t1"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe('Zone 1');
  });
});

