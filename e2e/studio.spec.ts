import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openStudio(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start making music' }).click();
  await expect(page.getByRole('heading', { name: '∞ Melodies' })).toBeVisible({ timeout: 30_000 });
  const skip = page.getByRole('button', { name: 'Skip' });
  await page.waitForTimeout(250);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByLabel('Project name')).toBeVisible();
}

test('first run offers the guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start making music' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to ∞ Melodies' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Open the guide' }).click();
  await expect(page.getByRole('dialog', { name: 'Guide' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to studio' }).click();
});

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

test('applies a song template and shows section regions', async ({ page }) => {
  await openStudio(page);
  await page.selectOption('select[aria-label="Arrangement template"]', 'Radio · 36 bars');
  const sections = await page.evaluate(() => JSON.parse(localStorage.getItem('edm-chordgen-state-v1') ?? '{}')?.melody?.sections as { kind: string; bars: number }[]);
  expect(sections).toHaveLength(7);
  expect(sections.filter(section => section.kind === 'drop')).toHaveLength(2);
  expect(sections.reduce((sum, section) => sum + section.bars, 0)).toBe(36);
});

test('no serious or critical accessibility violations', async ({ page }) => {
  await openStudio(page);
  // Color-contrast is tracked separately as a design-token task; this gate
  // catches structural/ARIA regressions.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking, blocking.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});
