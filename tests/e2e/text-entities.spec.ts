import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const saved: any[] = [];
    (window as any).__TEXT_ENTITY_YAML_SAVE__ = { saved };
    (window as any).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (text: string) => saved.push(text),
        close: async () => {},
      }),
    });
    (window as any).URL.createObjectURL = () => 'blob:text-entity-yaml-save';
    (window as any).URL.revokeObjectURL = () => {};
  });

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.projectYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
    window.localStorage.removeItem('phaseractions.themeMode.v1');
    window.localStorage.removeItem('phaseractions.uiScale.v1');
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  });
  await page.reload();
});

test('creates a text entity, edits it, and round-trips via YAML', async ({ page }) => {
  await gotoStudio(page);
  await dismissViewHint(page);

  const initial = await getState<any>(page);
  const sceneId = initial.currentSceneId as string;
  await page.getByTestId(`sprites-add-${sceneId}`).click();
  await page.getByTestId('sprites-add-menu-create-text').click();

  await expect(page.getByTestId('entity-text-content')).toBeVisible();
  await page.getByTestId('entity-text-content').fill('Hello\nWorld');

  await page.getByTestId('yaml-save-as-button').click();
  await expect.poll(async () => page.evaluate(() => (window as any).__TEXT_ENTITY_YAML_SAVE__?.saved?.length ?? 0)).toBe(1);
  const savedYaml = await page.evaluate(() => (window as any).__TEXT_ENTITY_YAML_SAVE__?.saved?.[0] ?? null);
  expect(typeof savedYaml).toBe('string');

  await page.evaluate((yaml) => {
    window.localStorage.setItem('phaseractions.projectYaml.v1', String(yaml));
    window.localStorage.setItem('phaseractions.startupMode.v1', 'reload_last_yaml');
  }, savedYaml);

  await gotoStudio(page, { forceNavigate: true });
  await dismissViewHint(page);

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const entities = Object.values(state.scene?.entities ?? {});
    return entities.some((e: any) => e?.text?.value === 'Hello\nWorld');
  }).toBe(true);
});
