// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleProject } from '../../src/model/sampleProject';

function renderEntityList() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const dispatch = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof EntityListView> = {
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
    scene: sampleProject.scenes[sampleProject.initialSceneId],
    selection: { kind: 'none' },
    sidebarScope: 'projectTree',
    expandedGroups: { 'g-enemies': false },
    mode: 'edit',
    dispatch,
  };

  return { container, root, dispatch, props };
}

describe('EntityList project settings', () => {
  it('opens project settings from Manage and dispatches saved scale + render mode values', async () => {
    const { container, root, dispatch, props } = renderEntityList();

    await React.act(async () => {
      root.render(<EntityListView {...props} />);
    });

    const manageButton = container.querySelector('[data-testid="project-tree-manage-button"]') as HTMLButtonElement | null;
    expect(manageButton).not.toBeNull();

    await React.act(async () => {
      manageButton!.click();
    });

    const settingsButton = container.querySelector('[data-testid="project-manage-settings"]') as HTMLButtonElement | null;
    expect(settingsButton).not.toBeNull();

    await React.act(async () => {
      settingsButton!.click();
    });

    await React.act(async () => {
      const preset = container.querySelector('[data-testid="project-settings-preset-2"]') as HTMLButtonElement | null;
      expect(preset).not.toBeNull();
      preset!.click();
    });

    await React.act(async () => {
      const renderMode = container.querySelector('[data-testid="project-settings-render-mode-smooth-2d"]') as HTMLButtonElement | null;
      expect(renderMode).not.toBeNull();
      renderMode!.click();
    });

    const saveButton = container.querySelector('[data-testid="project-settings-save"]') as HTMLButtonElement | null;
    expect(saveButton).not.toBeNull();

    await React.act(async () => {
      saveButton!.click();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'set-project-metadata', pixelsPerUnit: 2, renderMode: 'smooth-2d' });
  });
});
