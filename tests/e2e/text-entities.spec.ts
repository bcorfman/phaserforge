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
    window.localStorage.removeItem('phaserforge.projectYaml.v1');
    window.localStorage.removeItem('phaserforge.startupMode.v1');
    window.localStorage.removeItem('phaserforge.themeMode.v1');
    window.localStorage.removeItem('phaserforge.uiScale.v1');
    window.localStorage.removeItem('phaserforge.inspectorFoldouts.v1');
  });
  await page.reload();
});

test('creates a text entity, edits it, and round-trips via YAML @critical', async ({ page }) => {
  await gotoStudio(page);
  await dismissViewHint(page);

  const initial = await getState<any>(page);
  const sceneId = initial.currentSceneId as string;
  await page.getByTestId(`texts-add-${sceneId}`).click();

  await expect(page.getByTestId('entity-text-content')).toBeVisible();
  await page.getByTestId('entity-text-content').fill('Hello\nWorld');

  await page.getByTestId('yaml-save-as-button').click();
  await expect.poll(async () => page.evaluate(() => (window as any).__TEXT_ENTITY_YAML_SAVE__?.saved?.length ?? 0)).toBe(1);
  const savedYaml = await page.evaluate(() => (window as any).__TEXT_ENTITY_YAML_SAVE__?.saved?.[0] ?? null);
  expect(typeof savedYaml).toBe('string');

  await page.evaluate((yaml) => {
    window.localStorage.setItem('phaserforge.projectYaml.v1', String(yaml));
    window.localStorage.setItem('phaserforge.startupMode.v1', 'reload_last_yaml');
  }, savedYaml);

  await gotoStudio(page, { forceNavigate: true });
  await dismissViewHint(page);

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const entities = Object.values(state.scene?.entities ?? {});
    return entities.some((e: any) => e?.text?.value === 'Hello\nWorld');
  }).toBe(true);
});

test('F3 focuses text content and supports live preview with Enter commit / Escape revert @smoke', async ({ page }) => {
  await gotoStudio(page);
  await dismissViewHint(page);

  const initial = await getState<any>(page);
  const sceneId = initial.currentSceneId as string;
  await page.getByTestId(`texts-add-${sceneId}`).click();

  const created = await getState<any>(page);
  const entityId = created.selection?.id as string;
  const originalValue = created.scene?.entities?.[entityId]?.text?.value as string;

  await page.keyboard.press('F3');

  const textInput = page.getByTestId('entity-text-content');
  await expect(textInput).toBeFocused();
  await expect.poll(async () => textInput.evaluate((node) => {
    const field = node as HTMLTextAreaElement;
    return field.selectionStart === 0 && field.selectionEnd === field.value.length;
  })).toBe(true);

  await page.keyboard.type('Preview');
  await expect.poll(async () => (await getState<any>(page)).scene?.entities?.[entityId]?.text?.value).toBe('Preview');

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await getState<any>(page)).scene?.entities?.[entityId]?.text?.value).toBe(originalValue);

  await page.keyboard.press('F3');
  await expect(textInput).toBeFocused();
  await page.keyboard.type('Committed');
  await expect.poll(async () => (await getState<any>(page)).scene?.entities?.[entityId]?.text?.value).toBe('Committed');
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await getState<any>(page)).scene?.entities?.[entityId]?.text?.value).toBe('Committed');
  await expect.poll(async () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)).not.toBe('entity-text-content');
});
