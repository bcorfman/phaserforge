import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, openSceneScope, seedProject } from './helpers';

test.describe('Scene input maps', () => {
  test.describe.configure({ timeout: 120000 });

  test('selects project default / none and jumps to Project input maps editor @critical', async ({ page }) => {
    const project = createEmptyProject();
    project.inputMaps = {
      gameplay: { actions: { Jump: [], Pause: [] } } as any,
      ui: { actions: { Confirm: [] } } as any,
    };
    project.defaultInputMapId = 'gameplay' as any;
    project.scenes[project.initialSceneId].input = {} as any;

    await seedProject(page, project);
    await dismissViewHint(page);
    await openSceneScope(page);

    await expect(page.getByTestId('scene-inspector-panel')).toBeVisible();
    await page.getByTestId('scene-inspector-panel').getByText('Expand All').click();
    await page.getByTestId('scene-input-foldout').scrollIntoViewIfNeeded();

    const activeSelect = page.getByTestId('scene-active-input-map-select');
    const fallbackSelect = page.getByTestId('scene-fallback-input-map-select');

    await expect(activeSelect).toBeVisible();
    await expect(fallbackSelect).toBeVisible();

    // Defaults to (project default)
    await expect(activeSelect).toHaveValue('__project_default__');
    const sceneInputPanel = page.getByTestId('scene-input-foldout');
    await expect(page.getByText('Actions in Active Map')).toBeVisible();
    await expect(sceneInputPanel.getByText('Jump')).toBeVisible();
    await expect(sceneInputPanel.getByText('Pause')).toBeVisible();

    // Selecting none disables fallback + clears action list.
    await activeSelect.selectOption('__none__');
    await expect(activeSelect).toHaveValue('__none__');
    await expect(fallbackSelect).toBeDisabled();
    await expect(page.getByText('No actions found in the selected maps.')).toBeVisible();

    // Edit Input Maps jumps to Project tab and scrolls to Input Maps panel.
    await page.getByTestId('edit-input-maps-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toBeVisible();
    await expect(page.getByTestId('input-maps-panel')).toBeVisible();
  });
});
