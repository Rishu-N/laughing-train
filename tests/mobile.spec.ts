/**
 * Mobile layout — below MOBILE_BREAKPOINT (768px) the OS goes single-window:
 * windows fill the screen, drag/resize are off, and the dock moves to the
 * bottom edge.
 */
import { expect, test } from '@playwright/test';
import { bootToDesktop, dockTiles, openAppFromMenu, windowByTitle } from './helpers';

test.beforeEach(async ({ isMobile }) => {
  test.skip(!isMobile, 'Mobile-only layout assertions');
});

test('windows fill the screen at phone width', async ({ page }) => {
  await bootToDesktop(page);
  const win = windowByTitle(page, /^Browser/);
  const viewport = page.viewportSize()!;

  const box = await win.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(Math.round(box!.width)).toBe(viewport.width);
  // Sits under the menu bar and above the dock, but spans the full width.
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y).toBeLessThan(40);
});

test('the dock is a bottom bar and the resize grip is gone', async ({ page }) => {
  await bootToDesktop(page);
  const viewport = page.viewportSize()!;

  const dock = page.locator('[data-dock]');
  await expect(dock).toBeVisible();
  const box = await dock.boundingBox();
  expect(Math.round(box!.width)).toBe(viewport.width);
  // Bottom-anchored: its bottom edge is the bottom of the viewport.
  expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(viewport.height - 2);
  // ...and it is a short bar, not a tall right-hand rail.
  expect(box!.height).toBeLessThan(viewport.height / 3);

  await expect(page.getByRole('separator', { name: 'Resize window' })).toHaveCount(0);
});

test('the page body never scrolls horizontally', async ({ page }) => {
  await bootToDesktop(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('an app opens from the desktop icon with a single tap', async ({ page }) => {
  await bootToDesktop(page);

  // Single-window OS: the Browser fills the screen, so get it out of the way
  // before reaching for a desktop icon.
  const browser = windowByTitle(page, /^Browser/);
  await browser.locator('button[aria-label^="Close "]').click();
  await expect(browser).toHaveCount(0);

  // One tap, not a double-click — a double-tap on touch reads as a zoom.
  await page.getByRole('button', { name: /^Paint/ }).first().click();
  await expect(windowByTitle(page, /Paint/)).toBeVisible();
});

test('an app also opens from the Apps menu while a window is on screen', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Notes');
  await expect(page.getByRole('textbox', { name: 'Note text' })).toBeVisible();
  // Both windows are still running, stacked, and both have dock tiles.
  await expect(dockTiles(page)).toHaveCount(2);
});
