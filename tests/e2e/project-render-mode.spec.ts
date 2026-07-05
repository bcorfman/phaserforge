import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, seedProject } from './helpers';
import { sampleProject } from '../../src/model/sampleProject';

test.describe('Project render mode', () => {
  test('project settings save smooth-2d render mode through the manage dialog @smoke', async ({ page }) => {
    const project = {
      ...sampleProject,
      id: 'project-render-mode',
      title: 'Render Mode Demo',
      pixelsPerUnit: 2,
      renderMode: 'pixel-art',
    } as any;

    await seedProject(page, project);
    await dismissViewHint(page);

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-settings').click();
    await expect(page.getByTestId('project-settings-dialog')).toBeVisible();
    await page.getByTestId('project-settings-render-mode-smooth-2d').click();
    await page.getByTestId('project-settings-save').click();

    await expect.poll(async () => {
      const state = await getState<{ project?: { renderMode?: string } } | null>(page);
      return state?.project?.renderMode ?? null;
    }).toBe('smooth-2d');
  });
});
