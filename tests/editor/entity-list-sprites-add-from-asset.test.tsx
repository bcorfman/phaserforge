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

describe('EntityList Sprites + Add menu', () => {
  it('opens a Sprite (from Asset) picker instead of navigating to Project', async () => {
    const project = {
      ...sampleProject,
      assets: {
        ...sampleProject.assets,
        images: {
          ...(sampleProject.assets.images ?? {}),
          hero: { source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', originalName: 'hero.png', mimeType: 'image/png' } },
        },
      },
    };

    const { container, root, dispatch, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const addButton = container.querySelector(`[data-testid="sprites-add-${sampleProject.initialSceneId}"]`) as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();

    await React.act(async () => {
      addButton!.click();
    });

    const menu = container.querySelector('[data-testid="sprites-add-menu"]');
    expect(menu).not.toBeNull();

    const fromAsset = container.querySelector('[data-testid="sprites-add-menu-from-asset"]') as HTMLButtonElement | null;
    expect(fromAsset).not.toBeNull();

    await React.act(async () => {
      fromAsset!.click();
    });

    expect(container.querySelector('[data-testid="sprites-add-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="sprite-from-asset-picker"]')).not.toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'set-sidebar-scope', scope: 'project' });

    const pickHero = container.querySelector('[data-testid="sprite-from-asset-pick-image-hero"]') as HTMLButtonElement | null;
    expect(pickHero).not.toBeNull();

    await React.act(async () => {
      pickHero!.click();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'create-entity-from-asset', assetKind: 'image', assetId: 'hero' });
  });

  it('offers Text creation via the Text section (not Sprites + Add)', async () => {
    const project = {
      ...sampleProject,
      scenes: {
        ...sampleProject.scenes,
        [sampleProject.initialSceneId]: {
          ...(sampleProject.scenes[sampleProject.initialSceneId] as any),
          entities: {
            ...(sampleProject.scenes[sampleProject.initialSceneId] as any).entities,
            t1: {
              id: 't1',
              x: 10,
              y: 10,
              width: 10,
              height: 10,
              text: { value: 'Hello', fontSize: 18, color: '#fff', align: 'left' },
              asset: undefined,
            },
          },
        },
      },
    };

    const { container, root, dispatch, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const spritesAdd = container.querySelector(`[data-testid="sprites-add-${sampleProject.initialSceneId}"]`) as HTMLButtonElement | null;
    expect(spritesAdd).not.toBeNull();

    await React.act(async () => {
      spritesAdd!.click();
    });

    expect(container.querySelector('[data-testid="sprites-add-menu-create-text"]')).toBeNull();

    const textAdd = container.querySelector(`[data-testid="texts-add-${sampleProject.initialSceneId}"]`) as HTMLButtonElement | null;
    expect(textAdd).not.toBeNull();

    await React.act(async () => {
      textAdd!.click();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'create-text-entity' });
  });

  it('shows a text entity name and selects it when clicked', async () => {
    const project = {
      ...sampleProject,
      scenes: {
        ...sampleProject.scenes,
        [sampleProject.initialSceneId]: {
          ...(sampleProject.scenes[sampleProject.initialSceneId] as any),
          entities: {
            ...(sampleProject.scenes[sampleProject.initialSceneId] as any).entities,
            t1: {
              id: 't1',
              name: 'Title Text',
              x: 10,
              y: 10,
              width: 10,
              height: 10,
              text: { value: 'Hello', fontSize: 18, color: '#fff', align: 'left' },
              asset: undefined,
            },
          },
        },
      },
    };

    const { container, root, dispatch, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const row = container.querySelector('[data-testid="text-entity-t1"]') as HTMLButtonElement | null;
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('Title Text');

    await React.act(async () => {
      row!.click();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'select', selection: { kind: 'entity', id: 't1' } });
  });

  it('enters rename mode when clicking an already-selected text entity row', async () => {
    const project = {
      ...sampleProject,
      scenes: {
        ...sampleProject.scenes,
        [sampleProject.initialSceneId]: {
          ...(sampleProject.scenes[sampleProject.initialSceneId] as any),
          entities: {
            ...(sampleProject.scenes[sampleProject.initialSceneId] as any).entities,
            t1: {
              id: 't1',
              name: 'Title Text',
              x: 10,
              y: 10,
              width: 10,
              height: 10,
              text: { value: 'Hello', fontSize: 18, color: '#fff', align: 'left' },
              asset: undefined,
            },
          },
        },
      },
    };

    const { container, root, props } = renderEntityList({
      project: project as any,
      scene: project.scenes[sampleProject.initialSceneId] as any,
      selection: { kind: 'entity', id: 't1' } as any,
    });

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const row = container.querySelector('[data-testid="text-entity-t1"]') as HTMLButtonElement | null;
    expect(row).not.toBeNull();

    await React.act(async () => {
      row!.click();
    });

    expect(container.querySelector('[data-testid="rename-entity-input-t1"]')).not.toBeNull();
  });
});
