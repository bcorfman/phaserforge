import { expect, test } from '@playwright/test';
import { seedSampleScene } from './helpers';

test('Formation members align with formation label', async ({ page }) => {
  await seedSampleScene(page);

  const chevron = page.getByTestId('toggle-group-g-enemies');
  await expect(chevron).toBeVisible();
  await chevron.click();

  const formationLabel = page.getByTestId('group-item-g-enemies');
  const memberLabel = page.getByTestId('group-member-g-enemies-e1');
  await expect(formationLabel).toBeVisible();
  await expect(memberLabel).toBeVisible();

  const delta = await page.evaluate(() => {
    const formationEl = document.querySelector('[data-testid="group-item-g-enemies"]') as HTMLElement | null;
    const memberEl = document.querySelector('[data-testid="group-member-g-enemies-e1"]') as HTMLElement | null;
    if (!formationEl || !memberEl) return null;

    const formationRect = formationEl.getBoundingClientRect();
    const memberRect = memberEl.getBoundingClientRect();
    const formationPaddingLeft = parseFloat(getComputedStyle(formationEl).paddingLeft || '0');
    const memberPaddingLeft = parseFloat(getComputedStyle(memberEl).paddingLeft || '0');

    const formationTextStart = formationRect.left + formationPaddingLeft;
    const memberTextStart = memberRect.left + memberPaddingLeft;
    return Math.round((memberTextStart - formationTextStart) * 10) / 10;
  });

  expect(delta).not.toBeNull();
  expect(Math.abs(delta!)).toBeLessThanOrEqual(1);
});

