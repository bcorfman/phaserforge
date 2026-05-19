// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EntityListView } from '../../src/editor/EntityList';

describe('EntityList multi-select entity overflow menu', () => {
  it('hides Rename and duplicates/deletes the full selection', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const dispatch = vi.fn();
    const sceneId = 'scene-1';
    const project: any = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        [sceneId]: {
          id: sceneId,
          world: { width: 800, height: 600 },
          entities: {
            a: { id: 'a', name: 'A', x: 10, y: 10, width: 10, height: 10 },
            b: { id: 'b', name: 'B', x: 20, y: 20, width: 10, height: 10 },
          },
          groups: {},
          attachments: {},
          behaviors: {},
          actions: {},
          conditions: {},
          triggers: [],
        },
      },
      initialSceneId: sceneId,
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EntityListView
          project={project}
          currentSceneId={sceneId}
          scene={project.scenes[sceneId]}
          selection={{ kind: 'entities', ids: ['a', 'b'] } as any}
          sidebarScope="scene"
          expandedGroups={{}}
          mode="edit"
          startupMode="new_empty_scene"
          dispatch={dispatch}
        />
      );
    });

    const menuButton = container.querySelector('[data-testid="entity-menu-a"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();

    await React.act(async () => {
      menuButton!.click();
    });

    const renameButton = container.querySelector('[data-testid="entity-menu-rename-a"]');
    expect(renameButton).toBeNull();

    const duplicateButton = container.querySelector('[data-testid="entity-menu-duplicate-a"]') as HTMLButtonElement | null;
    expect(duplicateButton).not.toBeNull();

    await React.act(async () => {
      duplicateButton!.click();
    });

    const duplicateDialog = container.querySelector('[data-testid="duplicate-entity-dialog"]');
    expect(duplicateDialog).not.toBeNull();

    const confirmDuplicate = container.querySelector('[data-testid="duplicate-entity-confirm"]') as HTMLButtonElement | null;
    expect(confirmDuplicate).not.toBeNull();

    await React.act(async () => {
      confirmDuplicate!.click();
    });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'duplicate-entities',
      entityIds: ['a', 'b'],
    }));

    // Re-open overflow menu and delete.
    await React.act(async () => {
      menuButton!.click();
    });
    const deleteButton = container.querySelector('[data-testid="entity-menu-delete-a"]') as HTMLButtonElement | null;
    expect(deleteButton).not.toBeNull();
    await React.act(async () => {
      deleteButton!.click();
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'delete-selection' });
  });
});

