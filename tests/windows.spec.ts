/**
 * Window management: drag, collapse, restore, close.
 *
 * NOTE ON MINIMIZE: collapsed windows deliberately stay MOUNTED — marked
 * `inert` with `pointer-events: none` — so the genie animation has something to
 * fly and the app keeps its state. "Is it minimized?" is therefore asserted on
 * the dock tile's state and the window's `inert` attribute, never on absence
 * from the DOM.
 */
import { expect, test } from '@playwright/test';
import { bootToDesktop, closeWindow, dockTile, dragWindowBy, windowByTitle, windows } from './helpers';

test.beforeEach(async ({ isMobile }) => {
  test.skip(Boolean(isMobile), 'Windows are full-screen and undraggable below the mobile breakpoint');
});

test('dragging a window by its title bar moves it', async ({ page }) => {
  await bootToDesktop(page);
  const win = windowByTitle(page, /^Browser/);

  const before = await win.boundingBox();
  expect(before).not.toBeNull();

  await dragWindowBy(page, win, 120, 80);

  await expect
    .poll(async () => {
      const box = await win.boundingBox();
      return box ? Math.round(box.x) : -1;
    })
    .toBeGreaterThan(Math.round(before!.x) + 60);

  const after = await win.boundingBox();
  expect(after!.y).toBeGreaterThan(before!.y + 40);
  // Size is unchanged — a drag is a move, not a resize.
  expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  expect(Math.round(after!.height)).toBe(Math.round(before!.height));
});

test('collapse marks the window inert and the dock tile collapsed, restore undoes it', async ({
  page,
}) => {
  await bootToDesktop(page);
  const win = windowByTitle(page, /^Browser/);
  const tile = dockTile(page, 'Browser');

  await expect(tile).toHaveAttribute('aria-label', /\(active\)$/);

  await win.locator('button[aria-label^="Collapse "]').click();

  // Still mounted — this is the deliberate behaviour.
  await expect(windows(page)).toHaveCount(1);
  await expect(page.locator('[data-window][inert]')).toHaveCount(1);
  await expect(tile).toHaveAttribute('aria-label', /\(collapsed\)$/);
  await expect(win).toHaveCSS('pointer-events', 'none');

  // Clicking the dock tile brings it back.
  await tile.click();
  await expect(page.locator('[data-window][inert]')).toHaveCount(0);
  await expect(tile).toHaveAttribute('aria-label', /\(active\)$/);
  await expect(win).toBeVisible();
});

test('closing a window removes it from the desktop and the dock', async ({ page }) => {
  await bootToDesktop(page);
  const win = windowByTitle(page, /^Browser/);

  await closeWindow(page, win);

  await expect(windows(page)).toHaveCount(0);
  await expect(dockTile(page, 'Browser')).toHaveCount(0);
  await expect(page.getByText('No apps running')).toBeVisible();
});

test('the zoom box maximizes and restores', async ({ page }) => {
  await bootToDesktop(page);
  const win = windowByTitle(page, /^Browser/);

  const before = await win.boundingBox();
  await win.locator('button[aria-label^="Zoom "]').click();
  await expect
    .poll(async () => (await win.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before!.width);

  await win.locator('button[aria-label^="Zoom "]').click();
  await expect
    .poll(async () => Math.round((await win.boundingBox())?.width ?? 0))
    .toBe(Math.round(before!.width));
});

test('clicking a background window brings it to the front', async ({ page }) => {
  await bootToDesktop(page);
  const browser = windowByTitle(page, /^Browser/);

  // Open a second window from the Apps menu.
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await page.getByRole('menuitem', { name: /Terminal/ }).first().click();
  const terminal = windowByTitle(page, /Terminal/);
  await expect(terminal).toBeVisible();

  const zOf = async (win: typeof browser) =>
    Number(await win.evaluate((el) => getComputedStyle(el).zIndex));

  expect(await zOf(terminal)).toBeGreaterThan(await zOf(browser));

  await browser.click({ position: { x: 5, y: 40 } });
  await expect.poll(async () => (await zOf(browser)) > (await zOf(terminal))).toBe(true);
});
