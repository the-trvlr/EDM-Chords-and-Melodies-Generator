import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openStudio(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start making music' }).click();
  await expect(page.getByRole('heading', { name: '∞ Melodies' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Project name')).toBeVisible();
}

test('studio loads, edits a chord and undoes it', async ({ page }) => {
  await openStudio(page);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  const cards = page.locator('section[aria-label="Chord progression"] button[aria-pressed]');
  await expect(cards).toHaveCount(4);
  await page.getByRole('button', { name: /Add chord/ }).click();
  await page.getByRole('menuitem').first().click();
  await expect(cards).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cards).toHaveCount(4);
});

test('no serious or critical accessibility violations', async ({ page }) => {
  await openStudio(page);
  // Color-contrast is tracked separately as a design-token task; this gate
  // catches structural/ARIA regressions.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking, blocking.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});
