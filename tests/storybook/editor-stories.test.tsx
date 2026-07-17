// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import { setupServer } from 'msw/node';

import preview from '../../.storybook/preview';
import { defaultApiHandlers } from '../../src/testing/msw/apiHandlers';
import { __resetCloudAccountPanelAuthCacheForTests } from '../../src/editor/CloudAccountPanel';
import * as toolbarStories from '../../src/editor/Toolbar.stories';
import * as inspectorPaneStories from '../../src/editor/InspectorPane.stories';
import * as cloudAccountPanelStories from '../../src/editor/CloudAccountPanel.stories';
import * as yamlStories from '../../src/editor/ViewbarYamlControls.stories';
import * as entityListStories from '../../src/editor/EntityList.stories';
import * as workspaceConflictModalStories from '../../src/editor/WorkspaceConflictModal.stories';
import * as starsEditorPanelStories from '../../src/editor/StarsEditorPanels.stories';

setProjectAnnotations(preview);

const server = setupServer(...defaultApiHandlers);

const composedToolbarStories = composeStories(toolbarStories);
const composedInspectorStories = composeStories(inspectorPaneStories);
const composedCloudStories = composeStories(cloudAccountPanelStories);
const composedYamlStories = composeStories(yamlStories);
const composedEntityListStories = composeStories(entityListStories);
const composedWorkspaceConflictStories = composeStories(workspaceConflictModalStories);
const composedStarsEditorPanelStories = composeStories(starsEditorPanelStories);

async function renderStoryAndPlay(Story: React.ComponentType & { play?: (context: { canvasElement: HTMLElement }) => Promise<void>; parameters?: any }) {
  __resetCloudAccountPanelAuthCacheForTests();
  const handlers = Story.parameters?.msw?.handlers;
  if (Array.isArray(handlers) && handlers.length > 0) {
    server.use(...handlers);
  }
  const { container } = render(<Story />);
  if (Story.play) {
    await Story.play({ canvasElement: container });
  }
  return container;
}

describe('storybook interaction stories', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('runs the toolbar interaction story', async () => {
    await renderStoryAndPlay(composedToolbarStories.ThemeAndScale as any);
    expect(true).toBe(true);
  });

  it('runs the inspector tab interaction story', async () => {
    await renderStoryAndPlay(composedInspectorStories.SwitchTabs as any);
    expect(true).toBe(true);
  });

  it('runs the cloud account interaction story against shared MSW handlers', async () => {
    const container = await renderStoryAndPlay(composedCloudStories.SignedInGithubUnlinked as any);
    expect(container.textContent).toContain('Connect GitHub');
  });

  it('runs the cloud account login and publish-gating stories', async () => {
    await renderStoryAndPlay(composedCloudStories.SignedOut as any);
    await renderStoryAndPlay(composedCloudStories.EmailLogin as any);
    const container = await renderStoryAndPlay(composedCloudStories.PublishRepoEntryReady as any);
    expect(container.textContent).toContain('https://alice.github.io/mygame/');
  });

  it('runs the cloud publish-ready and failure stories', async () => {
    let container = await renderStoryAndPlay(composedCloudStories.PublishReady as any);
    expect(container.textContent).toContain('Before first publish');
    container = await renderStoryAndPlay(composedCloudStories.PublishFirstTimeSuccess as any);
    expect(container.textContent).toContain('GitHub Pages accepted the deployment for zoof');
    container = await renderStoryAndPlay(composedCloudStories.PublishFailure as any);
    expect(container.textContent).toContain('GitHub denied GitHub Pages management access');
  });

  it('runs the YAML picker sync stories', async () => {
    await renderStoryAndPlay(composedYamlStories.ImportAndExportSharePickerStartLocation as any);
    expect(true).toBe(true);
  });

  it('runs the entity list scope stories', async () => {
    await renderStoryAndPlay(composedEntityListStories.SceneScopeDefault as any);
    await renderStoryAndPlay(composedEntityListStories.ProjectScopeDefault as any);
    expect(true).toBe(true);
  });

  it('runs the workspace conflict stories', async () => {
    await renderStoryAndPlay(composedWorkspaceConflictStories.PreviewAndChooseCloud as any);
    await renderStoryAndPlay(composedWorkspaceConflictStories.ExportBothAndChooseDevice as any);
    expect(true).toBe(true);
  });

  it('runs the stars demo editor panel stories', async () => {
    await renderStoryAndPlay(composedStarsEditorPanelStories.ScatterDraftControls as any);
    await renderStoryAndPlay(composedStarsEditorPanelStories.SceneAppearanceControls as any);
    await renderStoryAndPlay(composedStarsEditorPanelStories.FormationVisualVariations as any);
    await renderStoryAndPlay(composedStarsEditorPanelStories.BoundsEventNoCodeAction as any);
    expect(true).toBe(true);
  });
});
