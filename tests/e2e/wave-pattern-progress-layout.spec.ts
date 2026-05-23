import { expect, test } from '@playwright/test';
import { sampleProject } from '../../src/model/sampleProject';
import { dismissViewHint, seedProject, selectGroupInSceneGraph } from './helpers';

test.beforeEach(async ({ page }) => {
  const project: any = structuredClone(sampleProject);
  const sceneId = project.initialSceneId;
  const scene = project.scenes[sceneId];

  scene.attachments = {
    ...(scene.attachments ?? {}),
    'att-wave-progress': {
      id: 'att-wave-progress',
      name: 'Intro step',
      order: 99,
      target: { type: 'group', groupId: 'g-enemies' },
      applyTo: 'group',
      enabled: true,
      presetId: 'WavePattern',
      params: { amplitude: 30, length: 80, velocity: 80, startProgress: 0.75, endProgress: 1 },
    },
  };

  await seedProject(page, project);
  await dismissViewHint(page);
});

test('Wave Pattern progress labels are not visually truncated @smoke @browser', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-wave-progress').click();

  const startLabel = page.getByText('Start Progress', { exact: true });
  const endLabel = page.getByText('End Progress', { exact: true });
  await expect(startLabel).toBeVisible();
  await expect(endLabel).toBeVisible();

  const startIsTruncated = await startLabel.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  const endIsTruncated = await endLabel.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(startIsTruncated).toBe(false);
  expect(endIsTruncated).toBe(false);

  const startInput = page.getByLabel('Wave Start Progress');
  const endInput = page.getByLabel('Wave End Progress');
  await expect(startInput).toBeVisible();
  await expect(endInput).toBeVisible();

  const startBox = await startInput.boundingBox();
  const endBox = await endInput.boundingBox();
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();
  if (!startBox || !endBox) return;

  // Ensure the fields are stacked vertically (separate lines) so the inputs have room.
  expect(endBox.y).toBeGreaterThan(startBox.y + 10);
  expect(startBox.width).toBeGreaterThan(60);
  expect(endBox.width).toBeGreaterThan(60);
});
