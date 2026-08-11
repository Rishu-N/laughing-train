/**
 * Shared helpers for the OS smoke suite.
 *
 * Two things every test needs: waiting out the boot overlay, and driving the
 * window manager without reaching into React internals. Everything here goes
 * through the same DOM the user does.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Every window frame in the DOM, including collapsed (minimized) ones. */
export function windows(page: Page): Locator {
  return page.locator('[data-window]');
}

/** One window frame, by its accessible name (the title bar text). */
export function windowByTitle(page: Page, title: string | RegExp): Locator {
  return page.getByRole('dialog', { name: title });
}

/** Dock tiles. Their accessible name is `${title}` + ' (active)' / ' (collapsed)'. */
export function dockTiles(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Running applications' }).getByRole('button');
}

/** One dock tile, matched on the title prefix of its accessible name. */
export function dockTile(page: Page, title: string): Locator {
  return dockTiles(page)
    .and(page.locator(`[aria-label^=${JSON.stringify(title)}]`))
    .first();
}

/**
 * Load the desktop and wait for the boot overlay to clear.
 *
 * The overlay is ~2s of Framer Motion; `waitFor detached` is the only honest
 * signal that the OS has actually started, and the Browser opens right after.
 */
export async function boot(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('boot-sequence')).toBeVisible();
  await page.getByTestId('boot-sequence').waitFor({ state: 'detached', timeout: 15_000 });
}

/** Boot, then wait for the auto-opened Browser window to be on screen. */
export async function bootToDesktop(page: Page): Promise<void> {
  await boot(page);
  await expect(windowByTitle(page, /^Browser/)).toBeVisible();
}

/**
 * Open an app the way the user would — the Apps menu in the menu bar. Driving
 * this from the menu (rather than a store call) keeps the tests honest about
 * the registry actually being wired into the UI.
 */
export async function openAppFromMenu(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem').filter({ hasText: title }).first().click();
  await expect(menu).toBeHidden();
}

/**
 * Every app the registry knows about, read out of the Apps menu so the test
 * cannot rot when an app is added: new manifest entry, new menu row, new case.
 */
export async function registeredAppTitles(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // Only rows inside a category group are apps — "Close All Windows" is not.
  const titles = await menu
    .locator('[role="group"] [role="menuitem"] span.flex-1')
    .allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  return titles.map((t) => t.trim()).filter(Boolean);
}

/** Close a window using its title-bar close box. */
export async function closeWindow(page: Page, win: Locator): Promise<void> {
  await win.locator('button[aria-label^="Close "]').click();
  await expect(win).toHaveCount(0);
}

/** Drag a window by its title bar. Pointer events — `dragTo()` does not work here. */
export async function dragWindowBy(
  page: Page,
  win: Locator,
  dx: number,
  dy: number,
): Promise<void> {
  const bar = win.locator('div').first();
  const box = await bar.boundingBox();
  if (!box) throw new Error('window title bar has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Two moves: the first arms the drag, the second is the one that travels.
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 4 });
  await page.mouse.move(startX + dx, startY + dy, { steps: 4 });
  await page.mouse.up();
}

/** Type into the terminal and submit. */
export async function runTerminal(page: Page, command: string): Promise<void> {
  const input = page.getByRole('textbox', { name: 'Terminal input' });
  await input.click();
  await input.fill(command);
  await input.press('Enter');
}
