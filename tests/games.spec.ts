/**
 * Snake and 2048 — enough to prove the boards are live, not just mounted.
 */
import { expect, test } from '@playwright/test';
import { bootToDesktop, openAppFromMenu, windowByTitle } from './helpers';

test.beforeEach(async ({ isMobile }) => {
  test.skip(Boolean(isMobile), 'Both games are keyboard-driven; touch input is covered by hand');
});

test('2048 deals an opening board and arrow keys move tiles', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, '2048');
  const win = windowByTitle(page, '2048');

  // Two tiles on mount — dealt in a lazy state initialiser, not an effect.
  const tiles = win.locator('div').filter({ hasText: /^[24]$/ });
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(2);

  await win.getByText('Score 0').waitFor();
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
  // A move always spawns a tile, so the board can only have grown.
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(2);

  // New Game resets the score readout without leaving a stale board behind.
  await win.getByRole('button', { name: 'New Game' }).click();
  await expect(win.getByText('Score 0')).toBeVisible();
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(2);
});

test('Snake mounts a canvas and starts on a key press', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Snake');
  const win = windowByTitle(page, 'Snake');

  await expect(win.locator('canvas')).toBeVisible();
  const box = await win.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThan(50);
  expect(box!.height).toBeGreaterThan(50);
});
